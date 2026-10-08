# departments (front end)

**Design:** approved (Paper step 20, gap fix G4) · **Code:** contract mirror only (Block 1). No screens yet.

The Departments settings screen: a table of a branch's departments (name, head, items tagged, status) with add, rename, retire and restore, for the Branch Manager and System Admin; read only for the Store Manager, Accountant and Director, who get a branch picker.

## Contract
`types/departments-contract.ts` is a hand-written mirror of `backend/src/modules/inventory/departments/_shared/departments-contract.ts` (R23 to R26). `types/departments-contract.fixtures.json` is byte-identical to the back end's; `types/departments-contract.test.ts` types it with the mirror. Screens read the `can` flags and `canAdd`, never a role name.

Amendment 2: retire can answer `DEPARTMENT_HAS_OPEN_SECTIONS` (409) while any section is open. Restore stays and appears in a retired row's menu.

## Status
Built (desktop, Block 1): `components/departments-screen.tsx` (table, Add and Rename dialogs, Retire with its confirmation, Restore) and `services/departments-api.ts` (R23 to R26, real API; walked in a browser: add, duplicate-name refusal, rename, retire refused while a section is open, restore). Routes: `/app/manage/department-settings` (Branch Manager, Manage › Departments; the old head-assignment page stays at `/app/manage/departments`) and `/app/director/settings/departments` (Director, read only with a branch picker, under Operations › Branch Settings). Tagging items, a head and staff to an added department waits for a Paper design.
