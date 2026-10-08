# waste/reverse

**Design:** approved (Paper steps 20 and 23) · **Code:** built to the contract (Back end B).

Reversing a waste entry (W4). The original log and its WASTE ledger row stay; a reversing row returns the stock.

## Spec
- **W4 `POST /inventory/stock/waste/:id/reverse`**, body `{ reason: WRONG_ITEM | WRONG_QUANTITY | OTHER, note? }` (Other needs a note). **No PIN.** Response: the updated `WasteEntry`.
- Who: `waste.reverse_any` reverses any entry; `waste.reverse_own` reverses an entry the caller logged **earlier the same Nairobi day**. The rule is `reverseCheck` in `waste/_shared/waste-rules.ts` (the same function sets `can.reverse` on every row). Errors: `NOT_YOUR_ENTRY` (403), `REVERSAL_WINDOW_PASSED` (403), `ALREADY_REVERSED` (409).
- One transaction: lock the log row, re-check under the lock, find the entry's WASTE ledger row (the one that is not itself a reversal), post the reversal through `postStockMovement` (same type, same positive quantity, `reversesTransactionId`; the door flips the sign so stock goes back up), stamp `reversed_at / reversed_by / reversal_reason / reversal_note`. A repeat or a race ends as `ALREADY_REVERSED`; the door's one-reversal-per-row index is the backstop.
- The reversal row keeps the original's unit cost, so the ledger's money nets to zero.

## Status
Built and tested (service with a mocked door; the six-role grid). Real-API walk: see `waste/README.md`.

## Endpoints
| # | Method and path | Capability |
|---|---|---|
| W4 | `POST /inventory/stock/waste/:id/reverse` | `waste.reverse_any` or `waste.reverse_own` (+ the service rule) |

## Coupling
`stock/ledger/ledger-door`, `_shared/central-store-access`, `waste/_shared/{waste-rules,waste-view}`.
