# dispatch (front end)

**Design:** approved (Paper *Inventory · Requisition and dispatch*, chapters 5 to 8, D1 to D21, gap fix G3) · **Code:** the OLD Milestone Five screens still run (`components/`, `hooks/`, `services/`, `types/`); the Block 2 contract mirror is added beside them. No new screens yet.

## New in `_shared/` (Block 2, contract in code)
- `_shared/types/dispatch-contract.ts`: hand-written mirror of the back end's frozen contract (P1 to P10, carriers included, the shared pieces the deliveries and discrepancies mirrors import). `dispatch-contract.fixtures.json` is byte-identical to the back end's (a back end test compares them); `dispatch-contract.test.ts` types it with the mirror and pins key sets, including "no money for the Attendant or the delivery notes" and "no sent figure for a branch-side caller before the count".
- `_shared/lib/states-copy.ts`: the wording skeleton from Paper D21 (eight states and the wording moments). The per-screen States kit copy and error wording are written by the front-end sessions.

The mirror is not exported from `index.ts` yet (the old `types/` would clash by name); that switch belongs to the PR that deletes the old screens.

Screens read the `can` flags and test whether a key is present (`sentQty`, money); they never test a role name. Titles, not names.
