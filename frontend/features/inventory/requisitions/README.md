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

## Desktop (Block 1, built on `feat/req-fe-desktop`)
- **Screens:** `requisitions-list-screen` (steps 7, 7b, 7c, 7d, 18b: one list for every role, modes queue / discrepancies / history, tabs and filters in the URL), `requisition-file-screen` (8, 9, 11, 12, 13, 16, cancelled file), `approve-drawer` (11), `cancel-dialog` (19), `additions-panel` (16), `file-items` (rail, lines, change-quantity popover), `file-extra-tabs` (Documents, Activity), `fill-for-head-sheet` ("Fill it myself"), `start-dialog`, `requisition-print-screen` (17, no money). Departments is in `../departments`.
- **Words:** `_shared/lib/requisitions-words.ts` writes every Next step title and body, tracker label, rail line, chip and error sentence (by audience) from Paper step 22; the back end sends facts only. `_shared/lib/list-copy.ts` is the per-tab empty and error wording on the States kit.
- **Service:** `_shared/services/requisitions-api.ts`. `NEXT_PUBLIC_REQUISITIONS_MOCK=1` answers from the contract fixtures (`requisitions-mock.ts`) until back end B lands; unset it at integration.
- **Mock scenarios:** in the browser, `sessionStorage.reqMockScenario` = `slow` (3 s, the loading skeleton), `empty`, `error` (every read fails), or `write:<CODE>` (every write is refused with that code). File ids ending `…0113` (Collecting, Housekeeping missing) and `…0114` (Approved, addition waiting) are extra mock states; the mock answers by the signed-in role (read-only for roles without the capability).
- **Badges:** `hooks/use-requisition-badges.ts` reads R2 and refetches on the `inventory:badges` socket nudge and on focus; the shell shows it on the Requisitions row.
- **Routes:** `/app/branch/requisitions[/discrepancies|/history|/:id]` (Branch Manager), `/app/inventory/requisitions[...]` (hub roles), `/app/branch/requisitions-print/:id`.
- **Built without a Paper screen** (same style, reported to the owner): the file's "…" menu, Documents and Activity contents, the Start dialog, "Fill it myself" editor, Cancelled file line, the Other-reason field in the change popover, Restore, Add and Rename dialogs.
- Old desktop screens (approval, history, both manager phone approval screens) and the print handoff are deleted. The old head screens and hooks stay for the phone session and the old dispatch.

## Status
Desktop built against fixtures; real API not wired. Phone screens are another session's.
