# dispatch (front end)

**Design:** approved (Paper *Inventory · Requisition and dispatch*, chapters 5 to 12: D1 to D6, D5b, N1 to N2, G3, the leave-out states and the D22 states sheet) · **Code:** the Store Attendant's phone screens are built (below) and read the real API (P1 to P9). The OLD Milestone Five desktop screens (`components/screens`, `hooks/use-dispatch-*`, `types/`) still run until the desktop lane replaces them.

## Phone screens (Block 2, `components/phone/`, one phone column at every width)
| Screen | Route | Notes |
|---|---|---|
| Dispatch tabs: To pack (D1), On the way (N2, N2b), Done (G3) | `/app/inventory/dispatch?tab=` | one card per branch; wait chip amber from 20 min; Branch and Date filters in the URL |
| Pack one department (D2) and the short-a-line sheet (D3) | `/app/inventory/dispatch/pack/[requisitionId]/[departmentId]` | ticks and quantities autosave about 500 ms after the last change (last write wins); a 500 on the first look is retried once |
| Every department packed (D4, not-every-department variant) | `.../pack/[requisitionId]` | "Go to the final review" opens once one department is fully ticked |
| Final review (D5), every line (D5b) | `.../review`, `.../review/lines` | leave out and put back are kept per requisition on the device until signed; not-ready departments are sent in `leaveOut` too (the API refuses the sign otherwise); the carrier chosen last time is remembered in `localStorage` |
| On the way (D6, partial send) | `.../sent` | remembered in the tab so a reload still shows it |
| Dispatch file (N1, N1b cancelled) | `/app/inventory/dispatch/[id]` | read only, no money |
| Delivery notes print | `/app/inventory/dispatch-print/batch?ids=` | plain A4 layout of P7 (store copy then branch copy per department) until the desktop D17 component is wired in |

Words live in `../_shared/lib/block2-words.ts` (errors, chips, empty lines from D22); shared parts in `../_shared/components/block2-phone-parts.tsx`; pure rules (what ships, short lines, wait chip) in `lib/pack-logic.ts` with tests.

**Reported for back end C:** P9 rows carry no `REQ-` reference or carrier (N2 draws both; the screen shows them when present); two simultaneous first reads of a department can collide on the dispatch row and one returns 500 (React dev mode shows it; the screen retries).

## New in `_shared/` (Block 2, contract in code)
- `_shared/types/dispatch-contract.ts`: hand-written mirror of the back end's frozen contract (P1 to P10, carriers included, the shared pieces the deliveries and discrepancies mirrors import). `dispatch-contract.fixtures.json` is byte-identical to the back end's (a back end test compares them); `dispatch-contract.test.ts` types it with the mirror and pins key sets, including "no money for the Attendant or the delivery notes" and "no sent figure for a branch-side caller before the count".
- `_shared/lib/states-copy.ts`: the wording skeleton from Paper D21 (eight states and the wording moments). The per-screen States kit copy and error wording are written by the front-end sessions.

**Amendment 1** (9 Oct 2026, `docs/features/inventory/dispatch-amendment-1.md`) is applied in the mirror, the fixtures and the tests. Lane split (row 18): the contract session owns `_shared`; desktop owns `dispatch/components/desktop`, `discrepancies/` and carriers; phone owns `dispatch/components/phone` and `deliveries/`; mocks per lane (`dispatch-mock-desktop.ts`, `dispatch-mock-phone.ts`); the orchestrator wires `nav-table.ts`, routes and `features/inventory/index.ts`.

The mirror is not exported from `index.ts` yet (the old `types/` would clash by name); that switch belongs to the PR that deletes the old screens.

Screens read the `can` flags and test whether a key is present (`sentQty`, money); they never test a role name. Titles, not names.
