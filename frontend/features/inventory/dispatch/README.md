# dispatch (front end)

**Design:** approved (Paper *Inventory · Requisition and dispatch*, chapters 5 to 12: D1 to D22, E1 to E3, N1 to N2, G3, the leave-out states and the D22 states sheet) · **Code:** the Store Attendant's **phone screens** (P1 to P9, real API) and the **desktop screens** (below) are both built. The desktop screens use the real API for everything the store side owns (P6 to P10) and, until back end D is wired in, a mock for its endpoints. The OLD Milestone Five desktop screens (`components/screens`, `hooks/use-dispatch-*`, `services/dispatch-api-service.ts`, `types/`) still exist until the integration PR deletes them.

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

## Desktop screens (`components/desktop/`)
- `dispatch-file-screen.tsx` (D13, E3, cancelled file): one file for every state. Chip and tracker (`progress-tracker.tsx`, the one tracker of D22: tick = done, ring = now, amber ring = someone must act, red cross = cancelled), the next-step card (`lib/dispatch-words.ts`), Items, Documents and Activity tabs, a **Print delivery note** menu (Store copy, Branch copy) and a "…" menu with **Cancel this dispatch** for holders of `dispatch.cancel` while it is On the way and uncounted. Money columns only when the rows carry `valueKes`; the Branch Manager sees no sent figure before the count is signed.
- `cancel-dispatch-dialog.tsx` (D20): chips (Packed the wrong lines, Branch asked us to stop, Vehicle did not leave, Other needing a note), the PIN, an idempotency key; `DISPATCH_ALREADY_COUNTED` closes the dialog and refreshes the file.
- `confirm-for-department-drawer.tsx` (D19 and its D22 walk): the Branch Manager's blind count for a department that has not counted 2 hours after signing: count, flag and recount, reason and photos, the summary that first shows the sent figure, the PIN. The sent figure is never in a pre-summary response.
- `requisition-dispatches-panel.tsx` (step 13): the "Items and dispatches" tab of an approved requisition (one row per department, packed by, signed by, carried by, lines, Open the dispatch, Cancel, Confirm for the department).
- `delivery-note-print-screen.tsx` (D17, D17b, D17c, the void band): A4, store copy with asked and sent, branch copy with a blank "Your count"; a long table continues on the next page with the header and headings repeated and "Page n of m"; the signature, received-by line and QR sit on the last page only (`paginateNote`, tested); a cancelled note prints under a red VOID band.
- `carriers-screen.tsx` (D18): add, rename, retire, restore; read only for roles without `carriers.manage`.
- `photo-strip.tsx`, `choice-chips.tsx`, `file-parts.tsx`: the photo viewer (authenticated image fetch, focus trapped), the radio-group chips, the shared next-step card and ruled blocks.

Routes: `/app/{inventory|branch}/requisitions/dispatch/:id`, `/app/branch/dispatch-print/:id?copy=store|branch`, `/app/inventory/carriers` (the Procurement group for the hub roles, the Manage group for the Branch Manager, read only).

## Wording and services (desktop)
- `lib/dispatch-words.ts` is the one wording table of the desktop screens (chips, tracker, next-step cards, the finding descriptions, errors, empty copy), written from Paper D22.
- `services/dispatch-desktop-api.ts`: real calls for P6, P7, P8 and carriers. `services/branch-side-api.ts`: Q1 to Q5 and the drawer's V2 to V6, through `services/mock-mode.ts` (mock by default until back end D is wired in). `hooks/use-record-nudge.ts` refetches on `dispatch:changed`, `discrepancy:changed`, `inventory:badges` and when the tab regains focus.

## New in `_shared/` (Block 2, contract in code)
- `_shared/types/dispatch-contract.ts`: hand-written mirror of the back end's frozen contract (P1 to P10, carriers included, the shared pieces the deliveries and discrepancies mirrors import). `dispatch-contract.fixtures.json` is byte-identical to the back end's (a back end test compares them); `dispatch-contract.test.ts` types it with the mirror and pins key sets, including "no money for the Attendant or the delivery notes" and "no sent figure for a branch-side caller before the count".
- `_shared/lib/states-copy.ts`: the wording skeleton from Paper D21 (eight states and the wording moments).

**Amendment 1** (9 Oct 2026, `docs/features/inventory/dispatch-amendment-1.md`) is applied in the mirror, the fixtures and the tests. Lane split (row 18): the contract session owns `_shared`; desktop owns `dispatch/components/desktop`, `discrepancies/` and carriers; phone owns `dispatch/components/phone` and `deliveries/`; mocks per lane (`dispatch-mock-desktop.ts`, `dispatch-mock-phone.ts`); the orchestrator wires `nav-table.ts`, routes and `features/inventory/index.ts`.

The mirror is not exported from `index.ts` yet (the old `types/` would clash by name); that switch belongs to the PR that deletes the old screens.

Screens read the `can` flags and test whether a key is present (`sentQty`, money); they never test a role name. Names appear as "Name · Title" where a record states who did something.

## Things the desktop lane left for integration
- Back end D's endpoints: set `NEXT_PUBLIC_DISPATCH_MOCK=off` (or flip the default in `mock-mode.ts`) and delete `dispatch-mock-desktop.ts`.
- The Queue tabs To pack, On the way and To confirm come from back end D's `tabOf`; the rows and empty copy are built.
- "Pack" and "Pack again" open the phone lane's pack route (`/app/inventory/dispatch`).
- The old Milestone Five desktop files (`dispatch-queue-fulfil-screen`, `delivery-note-screen`, the old discrepancy screens, `/app/inventory/dispatch-print`, `/app/inventory/discrepancies`) are deleted by whoever replaces their last user.
