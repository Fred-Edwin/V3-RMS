# departments (front end)

**Design:** approved (Paper step 20, gap fix G4) · **Code:** contract mirror only (Block 1). No screens yet.

The Departments settings screen: a table of a branch's departments (name, head, items tagged, status) with add, rename, retire and restore, for the Branch Manager and System Admin; read only for the Store Manager, Accountant and Director, who get a branch picker.

## Contract
`types/departments-contract.ts` is a hand-written mirror of `backend/src/modules/inventory/departments/_shared/departments-contract.ts` (R23 to R26). `types/departments-contract.fixtures.json` is byte-identical to the back end's; `types/departments-contract.test.ts` types it with the mirror. Screens read the `can` flags and `canAdd`, never a role name.

## Status
Not built. Components (table, add and rename dialogs), hooks and services arrive in Block 1's desktop front-end session. Nav row: Operations › Branch Settings › Departments (`nav-table.ts`).
