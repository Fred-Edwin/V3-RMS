# requisitions (front end)

**Design:** approved (Paper *Inventory · Requisition and dispatch*, steps 1 to 22, gap fixes G1 and G4) · **Code:** the OLD Milestone Four screens still run (`components/`, `hooks/`, `services/`, `types/`); the **rebuild has its contract mirror and wording only** (Block 1, 8 Oct 2026).

## New in `_shared/` (the rebuild)
- `_shared/types/requisitions-contract.ts`: hand-written mirror of the back end's frozen contract (R1 to R22). `requisitions-contract.fixtures.json` is byte-identical to the back end's (a back end test compares them); `requisitions-contract.test.ts` types it with the mirror and pins key sets, including "no money for a head, the Attendant or the print".
- `_shared/lib/states-copy.ts`: the states kit wording (Paper step 21), the table of every state and the eight-moment wording table (step 22). Titles, not names.

Not exported from `index.ts` yet (the old `types/` exports clash by name); the rebuild sessions switch the barrel when the old screens are deleted in the same PR.

## Screens (to build, Block 1)
Phone (heads): home, section, add item, send sheet, sent, my requisitions. Desktop: list (7 stage tabs), file (two-pane), change quantity, approve drawer, cancel dialog, additions, print. See `docs/features/inventory/requisitions-contract.md` §11 to §13.

## Status
Contract mirror and wording landed; components, hooks and services not started.
