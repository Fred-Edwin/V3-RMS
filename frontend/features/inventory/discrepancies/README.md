# discrepancies (front end)

**Design:** approved (Paper 7c, D14 to D16, D21) · **Code:** contract mirror only (Block 2). No screens yet.

The Discrepancies list (Open and Settled), the discrepancy file, the Record a finding drawer with its live "what this does", and the Reverse a finding dialog.

## Contract
`_shared/types/discrepancies-contract.ts` mirrors `backend/src/modules/inventory/discrepancies/_shared/discrepancies-contract.ts` (Q1 to Q5, plus the finding rules `FINDINGS_FOR`, `FINDING_PROFILE`, `FINDING_TEXT`). `discrepancies-contract.fixtures.json` is byte-identical to the back end's; `discrepancies-contract.test.ts` types it and pins that money (`lossValueKes`, `valueKes`) is absent without `requisitions.see_value`. Shared pieces come from `features/inventory/dispatch/_shared/types/dispatch-contract.ts`.

The Extra-line finding names are the contract's wording, not drawn in Paper; the owner confirms.
