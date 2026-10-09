# deliveries (front end)

**Design:** approved (Paper chapter 6 D7 to D12, D19, gap fix G2) · **Code:** contract mirror only (Block 2). No screens yet.

The branch side: My deliveries (waiting and past), the blind count, check, reasons and photos, the summary and the PIN; the Branch Manager's "confirm for the department".

## Contract
`_shared/types/deliveries-contract.ts` mirrors `backend/src/modules/inventory/deliveries/_shared/deliveries-contract.ts` (V1 to V6). `deliveries-contract.fixtures.json` is byte-identical to the back end's; `deliveries-contract.test.ts` types it and pins the blind rule: no sent figure, gap or stand-in anywhere before the confirm preview, and no money anywhere. Shared pieces come from `features/inventory/dispatch/_shared/types/dispatch-contract.ts`.

Amendment 1 (9 Oct 2026) is applied: `arrivedAt`, `direction` on the check and on each line, `recountUsed`, photos as `{ id, url }` with a delete result, V1 rows with cycle, carrier, the confirmer's title, `result` (`MATCHED`, `GAP_OPEN`, `GAP_RESOLVED`) and `gapCount`, V6's three times, and the row 11 codes. The phone lane owns this folder.

A save never says whether a count matches; the check does (`COUNT_AGAIN` once, then `SHORT` or `EXTRA`, final). The sent figure first appears in the confirm preview.
