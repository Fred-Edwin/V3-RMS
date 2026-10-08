# requisitions (front end)

**Design:** approved (Paper *Inventory · Requisition and dispatch*, steps 1 to 22, gap fixes G1 and G4) · **Code:** the OLD Milestone Four screens still run (`components/`, `hooks/`, `services/`, `types/`); the **rebuild has its contract mirror and wording only** (Block 1, 8 Oct 2026).

## New in `_shared/` (the rebuild)
- `_shared/types/requisitions-contract.ts`: hand-written mirror of the back end's frozen contract (R1 to R22). `requisitions-contract.fixtures.json` is byte-identical to the back end's (a back end test compares them); `requisitions-contract.test.ts` types it with the mirror and pins key sets, including "no money for a head, the Attendant or the print".
- `_shared/lib/states-copy.ts`: the states kit wording (Paper step 21), the table of every state and the eight-moment wording table (step 22). Titles, not names.

Not exported from `index.ts` yet (the old `types/` exports clash by name); the rebuild sessions switch the barrel when the old screens are deleted in the same PR.

## Screens
**Phone, Department Head (built, `components/phone/`)**, routes under `app/app/requisitions/` (the path the route gate already opens to heads; the old head routes are deleted):

| Route | Screen | Paper |
|---|---|---|
| `/app/requisitions` | `HeadHomeScreen`: cycle picker, Start, urgent Extra with note, Earlier today | 1, 18 |
| `/app/requisitions/[id]` | `HeadFileScreen`: suggested lines + Send as suggested; sent (Recall); manager changed a line; approved with the store (Add); closed, cancelled, skipped | 2, 5, 6, 10, 14 |
| `/app/requisitions/[id]/edit` (`?add=1`) | `HeadEditScreen`: Change lines (steppers, remove + Undo, autosave) and Add an item | 3, 4 |
| `/app/requisitions/[id]/add` (`?pick=1`) | `HeadAdditionScreen`: add to an approved requisition, PIN-signed | 15 |
| `/app/requisitions/history` | `HeadHistoryScreen`: date range, status, numbered pager, all in the URL | G1 |

Desktop screens (list, file, change quantity, approve drawer, cancel, additions, print, Departments) belong to the desktop session. See `docs/features/inventory/requisitions-contract.md` §11 to §13.

## Phone code map
- `services/requisitions-phone-api.ts` (the head's calls R3, R7 to R9, R11 to R15, R21); `requisitions-call.ts` (the one fetch seam, sends `Idempotency-Key` on signing writes); `requisitions-mock.ts` (in-memory stand-in, flag `NEXT_PUBLIC_REQUISITIONS_MOCK=1`, drive the Branch Manager from the console with `window.__requisitionsMock.approve() / managerChange() / cancel() / approveAddition() / reset()`). Leave the flag off at integration.
- `hooks/use-section-draft.ts` (the head's draft: local edits, whole-draft save a moment after the last change, removed lines counted on the device until sent); `use-head-requisitions.ts` (home, file, history loaders).
- `_shared/lib/phone-words.ts`: every phone word (errors by audience, headlines, banners, the head's tracker, addition and history copy).
- `lib/qty.ts`, `time.ts` (Nairobi, "1:52 pm"), `routes.ts`.

## Rules the phone screens follow
Pre-filled from restock level minus on hand; "changed" means the quantity differs or the line was added (removed lines are counted only before sending); recall and resend replace the manager's changes; the PIN sheet is one sheet with the summary and note and sets a PIN first when none (`sign-sheet.tsx`); every signing write sends an idempotency key (one per sheet opening); a cycle that already has a requisition shows Open, not Start. A department head uses the one shell (nav table rows Requisitions, Deliveries, Waste, History); a member still sits on the legacy tabs.

## Amendment 2 (8 Oct 2026)
The mirror and its fixtures carry Amendment 2 (`docs/features/inventory/requisitions-amendment-2.md`). Two things change what the screens write: the **Next step card and the tracker are facts only** (`nextStep` is `{ action, departmentId, facts }`, a tracker step has no `label`), so each screen writes the title, body and labels from Paper step 22; and the **cancel reason is "preset — note"** (`CANCEL_PRESETS`, `parseCancelReason`). The six new error codes are listed in `REQUISITION_ERROR_CODES`. Their wording by audience (heads: "Your list…", managers: "That section…") is **not written yet**: it comes from the front-end sessions' gap reports, which are not on this branch.

## Status
Contract mirror and wording landed. **Phone (heads): built against the mock, real API not wired** (back end B's R7, R9 and sockets are not built). Desktop: not started here.
