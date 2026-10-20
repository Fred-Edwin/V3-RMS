# Workforce segment 2, Payroll front end: handoff 2 (to the Paper-comparison session)

Working document. Delete it when Workforce ships. Written 20 Oct 2026 by the verification session. **Read in this order:** `docs/sessions/workforce-2-payroll-frontend.md` (the original brief; every rule still binds), `docs/sessions/workforce-2-payroll-frontend-handoff.md` (what was built, the rules it followed, decisions F1 to F13, and the original "What is left" list), then this file (what the verification session did, what is still left, and how to do it fast).

## Where things stand

- Branch `feat/workforce-2-payroll-frontend`, lane 1 worktree `/home/fred/Projects/V3-RMS-lanes/lane-1`. **Nothing pushed.** Working tree clean at the end of the session (check `git status`).
- Lane services: API 4101, front end 3101 (`http://lane1.localhost:3101`), Redis container `wendo-lane-1-redis` (leave it running; it is the lane's).
- `pnpm exec tsc --noEmit` clean (front end and back end). `vitest` on `components/app/shell` and `lib` passed; the Payroll folder's tests passed (8 files). **Not yet run: `pnpm lint`, `pnpm build`, the full back-end `pnpm test`.**
- The browser walk is DONE for HR, the Accountant, the Director and the Branch Manager (details below). The Paper comparison, a full hover pass, the owed tests, the safety-property check, the gates, the docs and the cleanup are NOT done.

## What the verification session did (commits, oldest first)

1. `fix(workforce-payroll): read the wire's organization names as site names`. **The month page crashed** (`view.sites` undefined): the API sends `organizations`, `organizationId`, `organizationName`. The handoff-1 note "wire names say `siteId` here" was wrong. One translator, `payroll/_shared/lib/wire.ts` (`fromWire`), wraps every read in `payroll-reads.ts`. Writes are not translated (none of their answers is read for site fields).
2. `fix(...): joined hairlines, full-height page, hover and focus on every link action, export saved note`.
   - `month/components/payroll-screen.tsx`: the hairline is now the master-detail row's own `border-t`, the row is `flex-1` (no fixed `calc(100dvh - 380px)`), the page has no bottom padding, so the months list's divider meets the hairline and both reach the bottom at any height. The section no longer scrolls on its own.
   - New `_shared/lib/link-style.ts` (`LINK_BUTTON`: hover, focus ring, motion) used by every underlined text action; pager previous/next buttons got hover, focus and motion (`months-list.tsx`, `_shared/components/numbered-pager.tsx`).
   - Export dialog says `Saved <filename>.` after a download.
3. Back end (own commit, with a test): `fix(workforce-payroll): a fully checked review stage says All checked, not 0 lines` (`months/month-stages.ts`).
4. `feat(...): HR's in-review month opens on Totals; the confirmation line clears itself`. `defaultTab()` in `_shared/lib/month-view.ts`; `PayrollTabs` clears `tab` from the URL when the chosen tab is the month's own default. The "said" line clears after 8 s.
5. `fix(...): the Payroll menu row follows Payroll itself, so the Accountant sees it`. **The Accountant never saw the Payroll row**: it was gated on the attendance switch, and the Accountant sits on the Central Store (no switch) and cannot read `attendance/switch/sites` (403). Now: `payroll/_shared/hooks/use-payroll-on.ts` + `payroll/shell.ts` (`usePayrollOn`: true when the months list has any month), `NavRule.needsPayroll`, `NavContext.payrollOn` in `components/app/shell/nav-table.ts`, wired in `use-shell-nav.ts`; the `wf-pay-runs` row uses `needsPayroll`. `nav-table.test.ts` got a role by switch matrix test. **Lane-2 merge list gains:** `nav-table.ts` (two fields, one visibility clause, the row), `use-shell-nav.ts` (import, hook call, context field, memo dep).
6. `fix(...): focus returns to the PIN after a refused signature` (`PinActDialog`).
7. `fix(...): lock dialog names every payout, voided banner full stop, publish role, month stays after an act`: Mark-as-paid shows "In the bank file" and "Paid another way" rows (it used to say "Net pay to staff" with only the bank part); the voided-file banner always ends with a full stop; the Publish dialog no longer doubles "(Accountant), Accountant"; after any act the address is pinned to the month so a Paid month does not jump to the next one.
8. `fix(...): two columns only from 1360 px; month picker below it`. At 1100 the detail pane was about 470 px (stage line overlapped, table clipped, sideways scroll). `min-[1100px]` became `min-[1360px]` for the row, the list and the picker (the stage line and the two tab grids stay at 1100). Picker got top padding.
9. `feat(...): the approver can send back from the header`: the only "Send back to HR" was at the foot of a 29-line list. A secondary button now sits beside "Approve the payroll" (`headerAction === 'APPROVE'`).
10. `chore(workforce-payroll): a branch-sized Payroll demo seed` (`backend/src/scripts/payroll-demo-seed.ts`), later extended with `up waiting` and `sweep`.

## What the browser walk proved (do not redo)

- Director (read only): all six tabs, Export dialog and download (POST exports 200), open-month estimate. HR: waiting banner (TABLES), review card, leave out, Add a line with a wrong then right PIN, tick all, a stale write refused in words from a second tab, Send, Publish, a correction with the live preview (version 2). Accountant: approve by keyboard (wrong PIN then right), Send back with a reason, the pay-out card, bank file download, voided file after a correction (banner and "Download again" gives `-v2.csv`), Mark as paid (wrong PIN then right), the lock banner with no actions, Open Rules link lands on the Statutory tab. Branch Manager: no menu row, `/app/workforce/payroll` bounces to their home.
- No refetch loops (each tab fetches twice in dev because of React strict mode, like the rest of the app).
- Widths checked with no horizontal overflow: 390, 768, 1100, 1440, 1920, 2560.
- Tab names used by the "Rules ↗" links all exist in `rules/lib/tab-defs.ts`.

## The demo data the lane holds RIGHT NOW (clean up at the end)

- Made by `timesheets-demo-seed.ts up` (24 people, `ZZD-` numbers, Nyeri Town switched on, login `demo.bm@wendo.test`) and `payroll-demo-seed.ts up waiting` plus a manual confirm and `sweep`.
- September 2026 is **IN_REVIEW** (HR sent it, the Accountant sent it back; HR's ticks are kept; 21 people, 29 lines). October is open. HR, Accountant and Director have PIN `4321`. Password for every login is `password123`. Nyeri Highway and the Central Store are "not on the new system".
- To reach each state for the comparison (all through the real endpoints; run from `backend/` with `API=http://localhost:4101`):
  - fresh start: `pnpm exec tsx src/scripts/payroll-demo-seed.ts down`, `pnpm exec tsx src/scripts/timesheets-demo-seed.ts down`, `pnpm exec tsx src/scripts/timesheets-demo-seed.ts up`;
  - **In review, calculated:** `... payroll-demo-seed.ts up` (confirms the tables, sweeps, ends In review: 27 people, 38 lines, 6 blocking);
  - **Waiting:** `... up waiting`, then `... sweep` (creates the month in Waiting). To leave Waiting: confirm Statutory in Rules as `accountant@` with PIN, confirm the overtime version through the API (`POST /workforce/rules/versions/:id/confirm {scope:'overtime.multipliers', pin}`: the Overtime tab offers no Confirm for the seeded version), then `... sweep`;
  - then drive the UI: HR ticks, leaves out the blockers (reason), sends; Accountant approves (PIN); HR publishes (PIN); Accountant downloads the bank file and marks paid.
- Cleanup (step 8 of handoff 1): `payroll-demo-seed.ts down` BEFORE `timesheets-demo-seed.ts down`, then confirm every site's attendance switch is off (Postgres MCP: `select * from attendance_site_switches`) and no `ZZ`/`ZZD-` rows remain. If any `payroll-proof`/`timesheets-proof` data is present, run their `down` too (payroll first).
- Browser notes (chrome-devtools MCP): the window cannot be resized; use `emulate` with `viewport: "1440x900x1"` (and `1440x1400x1`, `1920x1080x1`). Sign out with the sidebar "Sign out" button (not by clearing cookies). The login door allows 10 a minute. Paper Desktop must be running for the Paper tools.

## What is left, in order

1. **Paper comparison, fast.** Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · D. Pay". For each node, take the Paper screenshot (`get_screenshot`, scale 1) and the build screenshot at 1440 wide (set the viewport with `emulate`, save with `take_screenshot filePath` into the scratchpad), look at both, write down only the differences you can see. **Use `get_computed_styles` or `get_jsx` only when a difference is big enough that the screenshots cannot settle it, or when you are about to correct something.** Do not audit a screen that looks the same. Nodes (from `2-payroll-spec.md`): 13 `34VL-0` waiting; 14 `3559-0` Rules applied; 15 `35IW-0` Tax; 16 `35YU-0` Casual; 17 `36DI-0` Totals and review; 18 `36QQ-0` approve dialog; 19 `373H-0` Payslips (published); 20, 21 `37H4-0`, `3CA5-0` pay out and Mark as paid; 22 to 25 `37TW-0`, `3852-0`, `38I9-0`, `38SP-0` export; 26 `391Z-0` open month and the Director's estimate; 27, 28 `3AWN-0`, `3B7L-0` corrections; 29 `3BHO-0` paid month; also 01 `3AUK-0` How payroll works. Reach each build state with the recipe above (one pass through the states covers most nodes).
   - **Fix small differences yourself** (spacing, size, colour, copy). **For any major component that differs from Paper** (for example a different pattern for a control, a layout that is arranged differently, a component Paper does not draw at all that the build added), **do not choose: put both versions in front of the owner with the `AskUserQuestion` tool (screenshots or a short description of each, Paper's and the build's) and build the one they approve.** Things to ask about, already known to differ or to be beyond Paper: the header "Send back to HR" button; HR's in-review month opening on Totals instead of Timesheets; the two-column layout switching to a month picker below 1360 px; the Export dialog (Paper draws a popover); left-out people listed above the payslips; the Payroll row appearing only once Payroll has a month.
2. A full hover and keyboard pass over what the walk did not touch: table rows, tabs, cards, Export radio cards, the month picker, the correction kind cards. One keyboard run of HR's review and publish is still owed (the Accountant's approve was done).
3. **Tests still owed** (one per new interactive component): `PinActDialog` (key reuse, refusal in words, Enter does not sign, focus returns to the PIN), `StageLine`, the route gate (`lib/route-access` tests for the four roles; the nav matrix test is DONE), `wire.ts` (`fromWire`), `use-payroll-on` (roles that ask, off when empty), `defaultTab`.
4. **Prove the safety property**: with every switch off, HR, Accountant and Director see exactly the old payroll menu (no new row) and Branch Managers see nothing new; also "Payroll has not started yet" empty state and "a site not on the new system" (seen on the Timesheets tab already). The nav test covers the table; confirm live after the cleanup.
5. Gates once: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` in `frontend/`; `pnpm build && pnpm test` in `backend/` (the DB tests need `DATABASE_URL`). Size checks: no file over 350 lines (tests 400), none over 250 ideally; `wc -l` the payroll folder (`correction-dialog.tsx`, `review-card.tsx`, `payroll-screen.tsx` are the largest).
6. Docs: `frontend/features/workforce/payroll/README.md` (folders, endpoints used, the line-level changes outside the feature, parity manifest one line per screen, beyond-Paper list, tests); the decisions file `docs/features/workforce/decisions-2-payroll-frontend.md` (F1, F2 exist; add F3 to F13 from handoff 1 and F14 to F26 below); `docs/features/workforce/README.md` status row; `docs/PROJECT_STATUS.md` row; `docs/API_CONTRACT.md` note that the three headers are exposed; the lane-2 merge list (every line-level change outside the feature: `capabilities.ts`, the Home cards, `nav-table.ts`, `nav-table.test.ts`, `use-shell-nav.ts`, `route-access.ts`, the page shell, `payroll/shell.ts`).
7. Cleanup (see above), then the final message: (1) decisions table, (2) a 5-line recap in plain English, (3) beyond-Paper items and back-end fixes (the two earlier `fix(workforce-payroll):` commits plus "All checked"). Nothing "to do". Do not draft the next session's prompt. Stop for the owner's review.

## Decisions to add (F14 onward; question, choice, why, what changing it takes)

- F14 Wire names: reads are translated once (`fromWire`), so types keep saying `site`. Changing it: rename the types and drop the wrapper.
- F15 Two columns from 1360 px; below it a month picker. Why: shell menu plus a 280 px list leaves the detail pane too narrow at 1100 to 1359. Change: the four `min-[1360px]` classes.
- F16 The hairline is the row's top border and the row fills the page; no fixed height. Why: no gap at any screen height. Change: `payroll-screen.tsx`.
- F17 Content is centred at 1140 px like every Workforce screen; wide monitors get even side margins. Change: one shared width for all Workforce screens (owner decision).
- F18 HR's In review month opens on Totals (where the review card is). Change: `defaultTab`.
- F19 The Payroll menu row follows Payroll's own list (`usePayrollOn`), not the attendance switch. Why: the Accountant has no switch and no read of it. Change: `needsPayroll` on the row.
- F20 The confirmation line clears after 8 s; after an act the address keeps the month. Change: `payroll-screen.tsx`.
- F21 One link-button style for every underlined action; pager arrows hover like the page numbers.
- F22 After a refused signature the PIN is focused again.
- F23 Export says "Saved <file>" after a download.
- F24 Mark as paid shows the bank amount and the other payout methods (the lock dialog must not imply the whole net pay is in the file).
- F25 The approver's "Send back to HR" also sits in the header (Paper draws it only in the review card). Ask the owner.
- F26 Copy: the voided banner always ends with a full stop; the Publish dialog does not repeat the role; the Reviewed stage reads "All checked" at zero (back-end fix).

## Observations for the owner (not changed)

- Rules, Overtime tab: no Confirm for a rate version that is waiting (earlier segment, 1B); the Accountant had to confirm through the API.
- The review card repeats "Calculate again" on every blocking line plus once in the toolbar.
- The approve dialog's line "You cannot approve a month you prepared" is Paper's wording and shows to people who did not prepare it.
- Left-out people are listed above the payslips, so on a branch with many, the real payslips start low on the page.
- The Accountant's Payroll row appears a moment after the menu draws (it waits for a read).
