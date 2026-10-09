# deliveries (front end)

**Design:** approved (Paper chapter 6 D7 to D12, D19, gap fix G2) · **Code:** contract mirror only (Block 2). No screens yet.

The branch side: My deliveries (waiting and past), the blind count, check, reasons and photos, the summary and the PIN; the Branch Manager's "confirm for the department".

## Contract
`_shared/types/deliveries-contract.ts` mirrors `backend/src/modules/inventory/deliveries/_shared/deliveries-contract.ts` (V1 to V6). `deliveries-contract.fixtures.json` is byte-identical to the back end's; `deliveries-contract.test.ts` types it and pins the blind rule: no sent figure, gap or stand-in anywhere before the confirm preview, and no money anywhere. Shared pieces come from `features/inventory/dispatch/_shared/types/dispatch-contract.ts`.

A save never says whether a count matches; the check does (`COUNT_AGAIN` once, then `SHORT` or `EXTRA`, final). The sent figure first appears in the confirm preview.
