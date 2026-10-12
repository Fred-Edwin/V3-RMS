# deliveries (front end)

**Design:** approved (Paper chapter 6 D7 to D12, D19, gap fix G2, Block 2 gaps N3a and N3b) · **Code:** the phone screens run on the real V1 to V7 (integrated 9 Oct 2026 on `feat/dispatch-integration`); the mock is deleted.

## Phone screens (`components/phone/`)
| Screen | Route |
|---|---|
| Deliveries waiting, with Earlier today (D7) | `/app/deliveries` |
| Count what arrived (D8), count again (D9), reason and photo sheet (D10) | `/app/deliveries/[id]/count` |
| Confirm with your PIN (D11) | `/app/deliveries/[id]/confirm` |
| Delivery confirmed (D12) | `/app/deliveries/[id]/done` |
| My delivery file (N3a gap open, N3b after a reversal) | `/app/deliveries/[id]` |
| My deliveries (G2): a member's History, and the head's Deliveries tab | `/app/deliveries/history`, `/app/requisitions/history?tab=deliveries` |

The count autosaves about 600 ms after the last key; "Check and sign" runs the check; the second count is final. A photo is shrunk to 1600 px before upload (`lib/shrink-image.ts`). The sent figure appears only on the confirm summary and the file after the count.

A member holds no `dispatch.read`, so the file (N3) calls `GET /inventory/deliveries/:id` (V7), which returns the dispatch file shape with the blind and money rules: no sent figure before the count is signed, no money without `requisitions.see_value`, `NOT_YOUR_DEPARTMENT` for another department, `NOT_ON_THE_WAY` for an unsigned dispatch. Department members are on the one shell (`usesAppShell(role, head, member)`): their menu is Deliveries and History. They have no Count tonight or Waste link because those older pages refuse a member at the API (see `block-2-undrawn-review.md`).

The branch side: My deliveries (waiting and past), the blind count, check, reasons and photos, the summary and the PIN; the Branch Manager's "confirm for the department".

## Contract
`_shared/types/deliveries-contract.ts` mirrors `backend/src/modules/inventory/deliveries/_shared/deliveries-contract.ts` (V1 to V7). `deliveries-contract.fixtures.json` is byte-identical to the back end's; `deliveries-contract.test.ts` types it and pins the blind rule: no sent figure, gap or stand-in anywhere before the confirm preview, and no money anywhere. Shared pieces come from `features/inventory/dispatch/_shared/types/dispatch-contract.ts`.

Amendment 1 (9 Oct 2026) is applied: `arrivedAt`, `direction` on the check and on each line, `recountUsed`, photos as `{ id, url }` with a delete result, V1 rows with cycle, carrier, the confirmer's title, `result` (`MATCHED`, `GAP_OPEN`, `GAP_RESOLVED`) and `gapCount`, V6's three times, and the row 11 codes. The phone lane owns this folder.

A save never says whether a count matches; the check does (`COUNT_AGAIN` once, then `SHORT` or `EXTRA`, final). The sent figure first appears in the confirm preview.
