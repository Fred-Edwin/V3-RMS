# requisitions (front end)

**Design:** approved (Paper *Inventory · Requisition and dispatch*, steps 1 to 22, gap fixes G1 and G4) · **Code:** the OLD Milestone Four screens still run (`components/`, `hooks/`, `services/`, `types/`); the **rebuild has its contract mirror and wording only** (Block 1, 8 Oct 2026).

## New in `_shared/` (the rebuild)
- `_shared/types/requisitions-contract.ts`: hand-written mirror of the back end's frozen contract (R1 to R22). `requisitions-contract.fixtures.json` is byte-identical to the back end's (a back end test compares them); `requisitions-contract.test.ts` types it with the mirror and pins key sets, including "no money for a head, the Attendant or the print".
- `_shared/lib/states-copy.ts`: the states kit wording (Paper step 21), the table of every state and the eight-moment wording table (step 22). Titles, not names.

Not exported from `index.ts` yet (the old `types/` exports clash by name); the rebuild sessions switch the barrel when the old screens are deleted in the same PR.

## Screens (to build, Block 1)
Phone (heads): home, section, add item, send sheet, sent, my requisitions. Desktop: list (7 stage tabs), file (two-pane), change quantity, approve drawer, cancel dialog, additions, print. See `docs/features/inventory/requisitions-contract.md` §11 to §13.

## Amendment 2 (8 Oct 2026)
The mirror and its fixtures carry Amendment 2 (`docs/features/inventory/requisitions-amendment-2.md`). Two things change what the screens write: the **Next step card and the tracker are facts only** (`nextStep` is `{ action, departmentId, facts }`, a tracker step has no `label`), so each screen writes the title, body and labels from Paper step 22; and the **cancel reason is "preset — note"** (`CANCEL_PRESETS`, `parseCancelReason`). The six new error codes are listed in `REQUISITION_ERROR_CODES`. Their wording by audience (heads: "Your list…", managers: "That section…") is **not written yet**: it comes from the front-end sessions' gap reports, which are not on this branch.

## Status
Contract mirror and wording landed; components, hooks and services not started.
