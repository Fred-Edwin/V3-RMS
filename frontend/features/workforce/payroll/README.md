# Workforce · Payroll (front end)

One page per calendar month for the whole company: the stage line, the KPI strip, six tabs, and the signed acts (send, approve, publish, pay, correct). Built 20 Oct 2026 on `feat/workforce-2-payroll-frontend` against the real back end (`backend/src/modules/workforce/payroll/`; API in `docs/API_CONTRACT.md` §40 and §41). Paper: file "Wendo RMS · Approved designs", page "Workforce · D. Pay", Chapter 12 steps 13 to 29 (step 1 is the help drawer). Choices: `docs/features/workforce/decisions-2-payroll-frontend.md`. Status: built, compared with Paper, awaiting the owner's review; nothing pushed.

## Folders

| Folder | Holds |
|---|---|
| `_shared/` | types (exact API shapes), `services/payroll-reads.ts` and `payroll-writes.ts` (one function per endpoint, file downloads), `hooks/` (`use-payroll-data`, `use-payroll-on`), `lib/` (`format`, `month-view`, `tax-words`, `wire`, `link-style`), `components/` (`pin-act-dialog`, `figures-card`, `numbered-pager`) |
| `month/` | the page (`payroll-screen`), months list, month picker (below 1360 px), stage line, the URL hook |
| `tabs/` | tab bar and the six tabs: Timesheets (in `sites/`), Rules applied, Tax and deductions, Casual pay, Totals, Payslips (with its drawer) |
| `sites/` | the Timesheets tab and its Remind and late-approve dialogs |
| `review/` | HR's review card, the line dialogs, send and send back, the hand-check drawer |
| `approve/`, `publish/`, `payout/` | the Approve, Publish and Mark-as-paid dialogs; the pay-out card |
| `corrections/` | the correction dialog (kind, live preview, reason, PIN) |
| `exports/` | the Export dialog and the file saver |
| `estimate/` | the Director's open-month estimate |
| `actions/` | the dispatcher for the page's dialogs |
| `help/` | "How payroll works" |
| `shell.ts` | what the app shell may import: `usePayrollOn` |

## Endpoints used

All under `/workforce/payroll`: `GET /months`, `/months/:key`, `/rules-applied`, `/tax`, `/casual`, `/totals`, `/payslips`, `/payslips/:id`, `/estimate`, `/review`, `/payout`, `/payslips/:id/correction-inputs`; `POST` review check, check-kind, leave-out, recalculate, adjustments, send-to-accountant, send-back, approve, publish, corrections, bank-file, mark-paid, remind, approve-site-late, exports. Plus `GET /workforce/timesheets/months/:key?site=` (the Director's late approve). Every POST sends an `idempotencyKey`; month writes send the month's `stateVersion`; a correction sends `expectedVersion`; Mark as paid sends `bankFileHash` read from the pay-out card.

## Rules the code follows

Buttons come from the month's server `capabilities` and `useWorkforcePermissions().can(...)`, never a role name. Money is text with two decimals, shown as whole shillings. Toasts and URLs carry no amounts. Reads are translated from the wire's `organization` names by `fromWire`. Every signed act goes through `PinActDialog` (one key per attempt, Enter never signs, refusals in words, a stale answer reloads). Numbers use `PadNumberInput`, choices use `Picker`, raw inputs say `autoComplete="off"` (`lib/input-conventions.test.ts` enforces this).

## Changes outside this feature (for the merge with the Payslips lane)

Each is small and on separate lines:

- `frontend/features/workforce/_shared/lib/capabilities.ts`: the five `payrun.*` entries became ten `payroll.*`.
- (History: these files were deleted in batch 2A, 22 Oct 2026) `frontend/features/workforce/home/cards/payrun-cards.tsx`, `hr-cards.tsx`, `home/gallery/home-gallery.tsx`: `payrun.approve` to `payroll.approve`; `payrun.reopen` to `payroll.approve_site_late`.
- `frontend/components/app/shell/nav-table.ts`: the `wf-pay-runs` row is now "Payroll" at `/app/workforce/payroll` (HR, Accountant, Director, System Admin); new `NavRule.needsPayroll`, `NavContext.payrollOn`, one visibility clause. `nav-table.test.ts`: three words "Pay runs" to "Payroll" and a role by switch matrix.
- `frontend/components/app/shell/use-shell-nav.ts`: the import, the `usePayrollOn` call, the context field, the memo dependency.
- `frontend/lib/route-access.ts`: one `under('/app/workforce/payroll')` block.
- `frontend/app/app/workforce/payroll/page.tsx`: a thin shell.
- Back end, own commits: `fix(workforce-payroll)` exposes `X-Bank-File-Hash`, `X-Document-Number`, `X-Revision` to the browser (with a test); a whole-number multiplier keeps its zero (with a test); a fully checked review stage says "All checked" (with a test).

## Parity manifest (Paper step, node, state)

| Step | Screen | Compared 20 Oct 2026 |
|---|---|---|
| 01 | How payroll works | Drawer, not Paper's full board (F30) |
| 13 | Waiting, Timesheets tab | Same pattern; seen in an earlier walk |
| 14 | Rules applied | Matches Paper's flat card (F27) |
| 15 | Tax and deductions | Matches; long example as steps (F27) |
| 16 | Casual pay | Matches (empty state seen; 24 px figures) |
| 17 | Totals and HR's review | Matches; filters added (F28) |
| 18 | Approve dialog | Matches, plus the first-month hand-check box |
| 19 | Publish dialog and Payslips | Matches; the staff banner is at the top (F29) |
| 20, 21 | Pay out, Mark as paid | Matches, plus "Paid another way" (F24) |
| 22 to 25 | Export | A dialog, not a popover (F6) |
| 26 | Open month and the estimate | Empty state seen; stored figures not compared |
| 27, 28 | Corrections | Built and walked with the live preview; not compared in the final pass |
| 29 | A paid month | Matches; Paper's grey lock banner (F31) |

## Beyond Paper

Every loading, empty, error, offline, locked and no-permission state; wrong, missing and locked-out PINs; "changed underneath you" and double clicks; the tax-tables waiting banner; a site not on the new system with a way to the old payslip run; blocking and ticked lines; the late-approver route; the voided bank file; a person with no bank account; a 200-person month (pager, filters, search); failed or slow exports; keyboard and screen-reader use; narrow widths (month picker, stacked review rows); the header Send back (F25); the Payroll row waiting on Payroll itself (F19).

## Tests

Pure logic in `_shared/lib/` (`month-view`, `sign-refusal`, `wire`, `tax-words`, `format`), `numbered-pager`, `exports/export-options`, `sites/site-words`, `review/review-words`, `corrections/correction-change`, `month/stage-line` (server-rendered), `_shared/hooks/use-payroll-on` (who asks), `lib/route-access.payroll.test.ts` (the gate for every role) and `components/app/shell/nav-table.test.ts` (the menu matrix). The front end's tests run in a node environment with no DOM.
