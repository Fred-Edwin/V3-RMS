# discrepancies (front end)

**Design:** approved (Paper 7c, D14 to D16, E1, E2, D21, D22) · **Code:** desktop screens built (Block 2, 9 Oct 2026); on a per-lane **mock** for Q1 to Q5 until back end D merges.

The Discrepancies list (Open and Settled), the discrepancy file, the Record a finding drawer with its live "what this does", and the Reverse a finding dialog.

## Screens (`components/`)
- `discrepancies-list-screen.tsx` (7c): Open and Settled tabs with counts, search by number or item, Branch (hub roles only) and Department filters, a date range on Settled, numbered pager, state in the URL. A row opens the file; **Record a finding** only where `can.recordFinding`, else **Open**. Phones get cards.
- `discrepancy-file-screen.tsx` (D14 open, E1 settled, E2 reopened after a reversal): next-step card or the finding block (who, when, against whom, stock effect, ledger entry, note, loss value for `requisitions.see_value` holders), "Every entry on this gap" once a reversal exists, the gap, who handled it or the Activity list, photos in a viewer.
- `finding-drawer.tsx` (D15): the findings the file allows (`allowedFindings`), each with its stock effect and who it is recorded against, the live preview (Q3), an optional note, the actor's own PIN, an idempotency key per open.
- `reverse-dialog.tsx` (D16): chips The item turned up, Recorded in error, Other (a note is required for Other), the PIN, an idempotency key.

Routes: `/app/inventory/requisitions/discrepancies[/:id]` and `/app/branch/requisitions/discrepancies[/:id]`. Wording is in `dispatch/lib/dispatch-words.ts` (Paper D22).

## Contract
`_shared/types/discrepancies-contract.ts` mirrors `backend/src/modules/inventory/discrepancies/_shared/discrepancies-contract.ts` (Q1 to Q5, plus the finding rules `FINDINGS_FOR`, `FINDING_PROFILE`, `FINDING_TEXT`). `discrepancies-contract.fixtures.json` is byte-identical to the back end's; `discrepancies-contract.test.ts` types it and pins that money (`lossValueKes`, `valueKes`) is absent without `requisitions.see_value`. Shared pieces come from `features/inventory/dispatch/_shared/types/dispatch-contract.ts`.

Amendment 1 (9 Oct 2026) is applied: a reversal returns the discrepancy to OPEN (status goes REVERSED then back to OPEN; `finding` is null, the `reversal` and every event stay), the list tabs carry `counts`, Record and Reverse carry an `idempotencyKey`, photos are `{ id, url }`, and `FINDING_NOT_REVERSIBLE` replaces the two old reversal codes. The desktop lane owns this folder.

## The mock
`dispatch/services/dispatch-mock-desktop.ts` answers Q1 to Q5 (and the deliveries V2 to V6 the Branch Manager's drawer walks) in memory, seeded from the fixtures, and follows the contract: the PIN is `1234`, a repeated idempotency key returns the first result, the Branch Manager reads their own branch only and records nothing. `dispatch/services/mock-mode.ts` holds the switch (`NEXT_PUBLIC_DISPATCH_MOCK=off` calls the real API); at integration the default flips and the mock file is deleted.

The Extra-line finding wording is the owner's (D22 "The Extra-line wording").
