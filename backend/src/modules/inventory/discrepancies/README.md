# discrepancies

**Design:** approved (Paper *Inventory · Requisition and dispatch*, 7c, D14 to D16, D21) · **Code:** contract only (Block 2, contract in code). No service, repository or migration yet; back end D builds them after back end C's migration merges.

A discrepancy (`DSC-{branch code}-nnnn`) opens when a department signs a count that differs from what was sent, one per differing line. The gap is held as **unaccounted** until the Store Manager (or System Admin) records **one finding** with a PIN; a wrong finding is reversed by a new linked entry. No tolerance, no escalation, no "send the rest". Rules: `docs/features/inventory/discrepancies.md`, `dispatch-contract.md` §6.

## Contract (frozen when the owner says so)
`_shared/discrepancies-contract.ts` (Zod, Q1 to Q5, plus `FINDINGS_FOR`, `FINDING_PROFILE`, `FINDING_TEXT`), `discrepancies-contract.fixtures.json` (byte-identical to `frontend/features/inventory/discrepancies/_shared/types/`), `discrepancies-contract.test.ts`.

## Findings
Short: packed short at the store (stock back to the store, a packing error, not a loss), lost or damaged on the way (written off at the cost frozen at dispatch, the carrier), branch counted wrong (department corrected up, the receiver), can't tell (written off, unexplained). Extra: packed more than recorded, branch counted wrong (corrected down), can't tell (taken in, unexplained). The Extra names are the contract's wording (not drawn in Paper; the owner confirms). Every posting goes through `postStockMovement` as a new linked entry carrying the `DSC-` number.

## Endpoints (under `/inventory/discrepancies`, placeholder router in `discrepancies-routes.ts`)
Q1 `GET /` (tab Open or Settled, branch, department, search, dates, pager) · Q2 `GET /:id` · Q3 `GET /:id/finding-preview?finding=` · Q4 `POST /:id/findings` · Q5 `POST /:id/reverse`.

## Access
`discrepancies.read` (every desktop role, a Branch Manager's own branch; department heads their own department by the department rule), `discrepancies.record`, `discrepancies.reverse` (Store Manager, System Admin). Money (`lossValueKes`, `valueKes`) follows `requisitions.see_value`.

The old router for `/discrepancies` lives in `dispatch/dispatch-routes.ts` and runs until back end C deletes it.
