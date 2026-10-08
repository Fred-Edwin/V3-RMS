# requisitions (front end)

**Design:** approved (Paper *Inventory · Requisition and dispatch*, steps 1 to 22, gap fixes G1 and G4) · **Code:** rebuilt (Block 1, 8 Oct 2026); the old Milestone Four screens are gone.

## New in `_shared/` (the rebuild)
- `_shared/types/requisitions-contract.ts`: hand-written mirror of the back end's frozen contract (R1 to R22). `requisitions-contract.fixtures.json` is byte-identical to the back end's (a back end test compares them); `requisitions-contract.test.ts` types it with the mirror and pins key sets, including "no money for a head, the Attendant or the print".
- `_shared/lib/states-copy.ts`: the states kit wording (Paper step 21), the table of every state and the eight-moment wording table (step 22). Titles, not names.

The mirror is exported from `index.ts` (the old `types/` that clashed by name is deleted).

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
- `services/requisitions-phone-api.ts` (the head's calls R3, R7 to R9, R11 to R15, R21); `requisitions-call.ts` (the one fetch seam, sends `Idempotency-Key` on signing writes); the phone service calls the real API only (the mock and its flag `NEXT_PUBLIC_REQUISITIONS_MOCK` were deleted at integration). To see a loading, empty or error state, throttle or block the request in the browser's network panel.
- `hooks/use-section-draft.ts` (the head's draft: local edits, whole-draft save a moment after the last change, removed lines counted on the device until sent); `use-head-requisitions.ts` (home, file, history loaders, which reload on the live nudge); `use-badges-nudge.ts` (the one place a screen listens for the `inventory:badges` socket nudge and for the tab coming back to the front).
- `_shared/lib/phone-words.ts`: every phone word (errors by audience, headlines, banners, the head's tracker, addition and history copy).
- `lib/qty.ts`, `time.ts` (Nairobi, "1:52 pm"), `routes.ts`.

## Rules the phone screens follow
Pre-filled from restock level minus on hand; "changed" means the quantity differs or the line was added (removed lines are counted only before sending); recall and resend replace the manager's changes; the PIN sheet is one sheet with the summary and note and sets a PIN first when none (`sign-sheet.tsx`); every signing write sends an idempotency key (one per sheet opening); a cycle that already has a requisition shows Open, not Start. A department head uses the one shell (nav table rows Requisitions, Deliveries, Waste, History); a member still sits on the legacy tabs.

## Amendment 2 (8 Oct 2026)
The mirror and its fixtures carry Amendment 2 (`docs/features/inventory/requisitions-amendment-2.md`). Two things change what the screens write: the **Next step card and the tracker are facts only** (`nextStep` is `{ action, departmentId, facts }`, a tracker step has no `label`), so each screen writes the title, body and labels from Paper step 22; and the **cancel reason is "preset — note"** (`CANCEL_PRESETS`, `parseCancelReason`). The six new error codes are listed in `REQUISITION_ERROR_CODES`. Their wording by audience is written: heads in `_shared/lib/phone-words.ts`, managers in `_shared/lib/requisitions-words.ts`.

## Desktop (Block 1, built on `feat/req-fe-desktop`)
- **Screens:** `requisitions-list-screen` (steps 7, 7b, 7c, 7d, 18b: one list for every role, modes queue / discrepancies / history, tabs and filters in the URL), `requisition-file-screen` (8, 9, 11, 12, 13, 16, cancelled file), `approve-drawer` (11), `cancel-dialog` (19), `additions-panel` (16), `file-items` (rail, lines, change-quantity popover), `file-extra-tabs` (Documents, Activity), `fill-for-head-sheet` ("Fill it myself"), `start-dialog`, `requisition-print-screen` (17, no money). Departments is in `../departments`.
- **Words:** `_shared/lib/requisitions-words.ts` writes every Next step title and body, tracker label, rail line, chip and error sentence (by audience) from Paper step 22; the back end sends facts only. `_shared/lib/list-copy.ts` is the per-tab empty and error wording on the States kit.
- **Service:** `_shared/services/requisitions-api.ts`, real API only. The contract mirror's fixtures stay for the contract test.
- **Live updates:** the list, the file and the phone screens refetch on the `inventory:badges` socket nudge and when the tab returns to the front (`hooks/use-badges-nudge.ts`). The list's table refetches when the stage tab changes because the tab rides in its refresh token (the table's own key does not include it).
- **Badges:** `hooks/use-requisition-badges.ts` reads R2 and refetches on the same nudge; the shell shows it on the Requisitions row.
- **Routes:** `/app/branch/requisitions[/discrepancies|/history|/:id]` (Branch Manager), `/app/inventory/requisitions[...]` (hub roles), `/app/branch/requisitions-print/:id`.
- **Built without a Paper screen** (same style, reported to the owner): the file's "…" menu, Documents and Activity contents, the Start dialog, "Fill it myself" editor, Cancelled file line, the Other-reason field in the change popover, Restore, Add and Rename dialogs.
- Old desktop screens (approval, history, both manager phone approval screens) and the print handoff are deleted. The old head screens and hooks stay for the phone session and the old dispatch.

## Status
Block 1 is integrated: phone (heads) and desktop run on the real API (8 Oct 2026, branch `feat/req-integration`), walked in a real browser with real users. The old approval, section and history hooks, the old service and the old types are deleted. Release steps: `docs/features/inventory/block-1-release.md`; screens built without a Paper drawing: `docs/features/inventory/block-1-undrawn-review.md`.
