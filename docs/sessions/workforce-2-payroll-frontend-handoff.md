# Workforce segment 2, Payroll front end: handoff to the verification session

Working document. Delete it when Workforce ships. Written 20 Oct 2026 by the build session. **Read `docs/sessions/workforce-2-payroll-frontend.md` first (the original brief: its rules still bind you, every one), then this file.** This file says what is built, how, what the lane is holding right now, and exactly what is left.

## Where things stand

- Branch `feat/workforce-2-payroll-frontend` (cut from `feat/workforce-segment-3`), lane 1 worktree `/home/fred/Projects/V3-RMS-lanes/lane-1`. Nothing pushed. Three commits on top of the base: two small back-end fixes (`fix(workforce-payroll):` expose `X-Bank-File-Hash`, `X-Document-Number`, `X-Revision` to the browser with a test; a whole-number multiplier such as "10" no longer loses its zero, with a test) and `feat(workforce-payroll): the Payroll page ...` (all the screens).
- `pnpm exec tsc --noEmit` is clean. `vitest` on `features/workforce`, `components/app/shell`, `lib` passes (110 files, 1,091 tests). **Not yet run: `pnpm lint`, `pnpm build`, the full backend `pnpm test`.** **No screen has been looked at in a browser yet.** Expect visual and runtime fixes.
- Lane services: API on 4101 and the front end on 3101 were started from this session with `nohup` (logs in the old session's scratchpad); the lane Redis container `wendo-lane-1-redis` was stopped and I started it with `docker start wendo-lane-1-redis`. Check `curl localhost:4101/api/v1/health` and `http://lane1.localhost:3101`; restart with `cd backend && pnpm dev` and `cd frontend && pnpm exec next dev -p 3101` if they are down.
- **The lane database currently holds proof data and a switched-on branch.** I ran `timesheets-proof.ts up` then `payroll-proof.ts up` (132 checks passed). Nyeri Town's attendance switch is ON. September 2026 is in state **TO_PUBLISH** (approved, `PAY-2026-09`), October is open. You MUST clean up at the end: `API=http://localhost:4101 pnpm exec tsx src/scripts/payroll-proof.ts down` BEFORE `timesheets-proof.ts down` (both in `backend/`), then confirm every site's switch is off (`select ... from attendance_site_switches` through the Postgres MCP, or `GET /workforce/attendance/switch` as admin) and that no `ZZ Proof` rows remain. Logins use password `password123`; the proofs set PIN `4321` for HR, Accountant and Director.

## What was built (all under `frontend/features/workforce/payroll/`)

Folders, none over 12 files. Each screen file is one main component.

| Folder | Holds |
|---|---|
| `_shared/` | `types/` (month, tab, action types, exact API shapes), `services/payroll-reads.ts` and `payroll-writes.ts` (one function per endpoint; file downloads via `fetchFile`; `BASE`, `query`), `hooks/use-payroll-data.ts` (one hook per read, `reloadOn(refresh)`), `lib/format.ts` (money as text, `kes`, dates in Nairobi time, `newKey`), `lib/month-view.ts` (tabs, default month, header action from the server `capabilities`, `refusalWords`/`STALE_CODES`), `lib/tax-words.ts`, `components/pin-act-dialog.tsx` (**the one dialog every PIN act uses**: one idempotency key per attempt, last digit enables, Enter never signs, refusal in words, new key and `onStale` after a stale answer), `components/numbered-pager.tsx` |
| `month/` | `payroll-screen.tsx` (the page), `months-list.tsx`, `month-picker.tsx` (below 1100 px), `stage-line.tsx`, `hooks/use-payroll-url.ts` (URL: `month`, `tab`, `q`, `page`, `rows`, `site`, `status`, `handcheck`), `lib/strip-cells.ts` |
| `tabs/` | `payroll-tabs.tsx` (dispatcher and tab bar), `rules-tab`, `tax-tab`, `casual-tab`, `totals-tab`, `payslips-tab`, `payslip-drawer` |
| `sites/` | Timesheets tab, `site-dialogs` (Remind, Director's late approve), `site-words` |
| `review/` | `review-card`, `line-dialogs` (leave out, calculate again, add a line), `send-dialogs` (send, send back), `hand-check-drawer`, `review-words` |
| `approve/`, `publish/`, `payout/` | the Approve, Publish and Mark-as-paid dialogs; `payout-card`, `payout-view` |
| `corrections/` | `correction-dialog` (kind, live preview, reason, PIN), `correction-change` (pure) |
| `exports/` | `export-menu` (a dialog), `export-options`, `save-file` |
| `estimate/` | `estimate-panel`, `estimate-bar` (the Director's open month) |
| `actions/` | `payroll-dialogs.tsx` (dispatcher: send, sendBack, approve, publish, pay, export) |
| `help/` | the "How payroll works" drawer and its copy |

Outside the feature (the lane-2 merge list, **each a small separate-line change; list them in the sub-module README**): `_shared/lib/capabilities.ts` (the five `payrun.*` entries became ten `payroll.*`); `home/cards/payrun-cards.tsx` and `hr-cards.tsx` and `home/gallery/home-gallery.tsx` (`payrun.approve` to `payroll.approve`, `payrun.reopen` to `payroll.approve_site_late`); `components/app/shell/nav-table.ts` (the `wf-pay-runs` row is now "Payroll", `/app/workforce/payroll`, roles HR, Accountant, Director, System Admin, `needsAttendance: true`); `nav-table.test.ts` (three words "Pay runs" to "Payroll"); `lib/route-access.ts` (one `under('/app/workforce/payroll')` block); `app/app/workforce/payroll/page.tsx` (thin shell).

## Rules this build followed (keep them)

- Buttons come from the month's `capabilities` and `useWorkforcePermissions().can(...)`, never a role name. Money is text with two decimals, shown as whole shillings. Toasts and URLs carry no amounts. Wire names say `siteId` here.
- Repo conventions the input tests enforce: `PadNumberInput` (`@/components/ui2/quantity-field`) for any number, `Picker` (`@/components/ui2/picker`) never a native `<select>`, `autoComplete="off"` on every raw input and textarea. `lib/input-conventions.test.ts` fails otherwise.
- Edit/Write tools only, one `Why:` line before each, explicit `git add <paths>`, commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No subagents, no pixel-diff. Do not re-verify the kit.
- The Payroll menu row shows only where the new clock is on (`needsAttendance`), which is how the "every switch off means the old menu is unchanged" property holds. The old `hr-payroll`/`director-payroll` rows (label "Payroll", old pages) are untouched, so with a switch on, HR and the Director see two rows both called Payroll. Log this as a decision and recommend renaming the old rows at cutover.

## Decisions to write into `docs/features/workforce/decisions-2-payroll-frontend.md`

The file exists with F1 (headers exposed) and F2 (`payrun.*` to `payroll.*`). Add these (question, choice, why, what changing it takes). I only wrote two rows so far:

- F3 Payroll's months list is its own component, not extracted from Timesheets (touching Segment 1's screen was not worth the risk); markup is the same. Change: extract to `_shared`.
- F4 The strip uses the kit's cell sizes (value 30 px, not the spec's 24) and the kit's `actionable`/`success` tones for the stage cell. Change: add a size prop to `WorkforceKpiStrip`.
- F5 First focus in a locking dialog (Mark as paid) lands on the PIN, not Cancel, because `KitDialog` focuses the first body field. Change: a prop on `KitDialog`.
- F6 Export is a dialog (as Timesheets does it), not a popover. The bank file is not in it; it is on the Totals tab. No background job above 100 people (back-end X3), so the "we will tell you" text is only a "big month" line after 10 s.
- F7 Mark as paid sends the file hash read from the pay-out card (`methods[0].file.hash`), not a value held from the download, so a page reload loses nothing.
- F8 No single-payslip PDF download (no endpoint until Segment 3); View opens a drawer with the lines and workings, and "Download all" is the zip in Export.
- F9 Waiting-state strip shows "-" for net and cost (the month read has no estimate for a waiting month); Open uses the stored estimate for the Director, HR, Accountant, System Admin.
- F10 The Accountant can see up front that they cannot approve a month they sent by comparing the name on the "Reviewed" stage with their own name; the server's `SELF_APPROVAL` still decides.
- F11 The hand-check drawer reads the payslips list and one payslip's lines; it is opened from the Tax tab or from the Approve dialog (`?tab=tax&handcheck=1`).
- F12 `rules-cards.ts` multiplier trim bug and the tax percent trim bug (found by a test) were fixed.
- F13 Late approve for the Director reads the site's timesheet totals from `GET /workforce/timesheets/months/:key?site=` (one read in `payroll-reads.ts`).
- Anything else you add beyond Paper.

## What is left (do it in this order; commit after each)

1. **Start the browser walk** (chrome-devtools MCP, `http://lane1.localhost:3101`, 1440 wide; log in as each role). State now: September is TO_PUBLISH. Walk: **HR** (`hr@wendo.test`): open Payroll, see the stage line, strip, tabs, Payslips tab drafts, Publish with PIN `4321` (check the wrong-PIN message first); **Accountant** (`accountant@`): Totals tab pay-out card, Download bank file (confirm a file saves and the hash is read), Mark as paid with a wrong then right PIN, then the lock banner and that every button is gone; **Director** (`director@`): read only, Export, the open-month estimate (October); **Branch Manager** (`bm.town@`): the route answers the no-access page and there is no menu row. A correction (HR corrects a payslip while PUBLISHED, creating v2 and voiding the bank file, Accountant downloads the new file) needs the month PUBLISHED before Paid, so do Publish, then correction, then bank file, then Mark as paid, in that order. Check the other roles through the API against the spec's permissions table (`2-payroll-spec.md` E9 table).
2. **The IN_REVIEW screens (review card, Send, Send back, Add a line, Leave out, Calculate again, stale write, waiting banner, tax-table banner) cannot be reached from the data now** because the proof walks September past review. After the later-state walk, run both `down` commands, then `timesheets-proof.ts up` and bring the month to IN_REVIEW by hand through the real endpoints and UI (Accountant confirms tax tables in Rules, Statutory with PIN; `sweepPayroll` is the job that calculates: it runs within 15 minutes, or call `POST .../recalculate` as HR once the tables are confirmed). The `payroll-proof.ts` source (lines ~146 to 260) shows the exact tables and calls; do not hand-write SQL. Then test: tick, a blocking line (Carol has no pay profile), leave out, add a line with PIN, send (disabled with its reason until all ticked), then the Accountant: wrong PIN, `SELF_APPROVAL` if the same person, a stale `stateVersion` in a second tab, send back with a reason, approve.
3. One screenshot of Paper beside the build per screen at 1440 (Paper file "Wendo RMS Approved designs", page "Workforce D. Pay", nodes in `2-payroll-spec.md` top table); fix visible differences. Also check 1100 wide once (month picker replaces the list).
4. One keyboard run of the Accountant's approve-with-PIN and of HR's review-and-publish. One test per new interactive component is still owed: add tests for `PinActDialog` (key reuse, refusal words, Enter does not sign) and `StageLine`, the Payroll nav rows (a role/switch matrix in `nav-table.test.ts` style: row hidden when the clock is off, hidden for Branch Manager, shown for System Admin when on) and the route gate (`route-access` for the four roles).
5. **Prove the safety property**: switch every site off, then HR, Accountant, Director see exactly the old payroll menu (no new row) and Branch Managers see nothing new. Also exercise "a site not on the new system" and the "Payroll has not started yet" empty state (fresh lane with no months).
6. Gates, once: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` in `frontend/`, `pnpm build && pnpm test` in `backend/` (the backend DB tests need `DATABASE_URL`; run `payroll-flow-db.test.ts` alone if needed). Size checks: no file over 350 lines (tests 400), none over 250 ideally; `wc -l` the payroll folder. `correction-dialog.tsx` and `review-card.tsx` are the largest; split if over 350.
7. Docs: `frontend/features/workforce/payroll/README.md` (what each folder does, endpoints used, the line-level changes outside the feature, parity manifest one line per screen, beyond-Paper list, tests), a README per sub-folder only if the repo rules require it (check CODING_STANDARDS section 9), the decisions file above, `docs/features/workforce/README.md` status row, `docs/PROJECT_STATUS.md` row, `docs/API_CONTRACT.md` note that the three headers are now exposed, ledger rows if the project keeps them.
8. **Clean up**: both `down` commands, every lane site switched off, no proof data, stop nothing you did not start. Leave the lane Redis container running (it is the lane's).
9. Final message: (1) decisions table, (2) a 5-line recap in plain English, (3) beyond-Paper items and back-end fixes made (the two `fix(workforce-payroll):` commits). Nothing "to do". Do not draft the next session's prompt. Stop for the owner's review.

## Known risks to look for in the browser

- `useRemote` keys: the Payslips and Review hooks include their filters in the key; check no refetch loop (watch the network list).
- `KitDialog` plain with `PinActDialog`: confirm the description/title read well and the PIN is focused on open.
- The strip's stage cell uses `actionable` without `onSelect`: confirm it renders as a plain `div` (it should).
- The tax percent and band rows read the stored band shape (`from`, `to`, `ratePercent`, `flatAmount`); verify against the lane's tables ("Alpha", "Gamma").
- `Callout` `action` placement for the tax banner (`actionAt="end"`) and the tables-waiting banner link to `/app/workforce/rules?tab=statutory`: confirm that tab parameter name matches the Rules screen (I guessed it; check `rules/lib/tab-defs.ts`). The "Rules ↗" links on the Rules applied cards use guessed tab names too (`overtime`, `lateness`, `leave`, `holidays`).
- The Export dialog's disabled radio cards and the `Export` button's `title` text when nothing is calculated.
