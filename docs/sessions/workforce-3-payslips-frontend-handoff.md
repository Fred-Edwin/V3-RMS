# Workforce segment 3, front end: handoff (session 1 to session 2)

Written 20 Oct 2026. Branch `feat/workforce-3-payslips-frontend` (cut from `feat/workforce-segment-3`, lane 2 worktree `~/Projects/V3-RMS-lanes/lane-2`). Nothing pushed. The original brief is `docs/sessions/workforce-3-payslips-frontend.md` (read it in full first: it holds the standing rules, scope, gates and final-message format). This file says what session 1 built, the choices it made, and exactly what session 2 must do. Delete both files when Workforce ships.

## Why two sessions
Session 1 built all the code (about 90 files). Session 2 verifies it in a real browser, writes the tests that remain, runs the full gates, writes the docs and the decisions table, and cleans the lane. Different work, and a fresh context avoids degraded performance.

## State at handoff
- Commits: `c8564515` (My payslips: unlock, home, detail, history, P9 card, document view) and `96f11c77` (casual pay: record with offline queue, approve with PIN, receipts, pay sheet document, nav and route-gate edits, notification wording, tests). Working tree clean after the handoff file is committed.
- Passing now: `pnpm exec tsc --noEmit`, `pnpm lint`, and `vitest` for `features/workforce/payslips`, `features/workforce/casual`, `features/workforce/_shared`, `components/app/shell`, `lib`.
- NOT yet run: the full `pnpm test`, `pnpm build`, any browser check, the back-end proof script. No proof data exists. No lane site has been switched on.
- Lane stack was started by session 1 and may still be running: Redis container `wendo-lane-2-redis`, API `pnpm dev` in `backend/` on 4102 (started with `RATE_LIMIT_MAX=100000`), front end `pnpm exec next dev -p 3102`, logs in the scratchpad. Check with `curl localhost:4102/api/v1/health` and `ss -ltn | grep 3102`; restart if down. Lane migrations were applied and `prisma generate` ran. Address: `http://lane2.localhost:3102`.

## Rules to keep (from CLAUDE.md and the brief; they are checked)
pnpm only. No `any`. Edit and Write tools only, never sed, awk, heredocs, `cp`. One line starting `Why:` before every Edit or Write. Live task list. Commit with `git add <explicit paths>` and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No subagents. No pixel-diff. Files at most 350 lines (aim 250), tests 400, no folder over 12 files. No he/she. Name plus role, never a bare name. Every disabled button shows its reason as text. One brown button per screen. Hidden amounts are not in the page. No pay figure in a notification or audit row. Final message: (1) decisions table, (2) 5-line recap, (3) beyond-Paper items and back-end fixes. Do not draft a further session prompt after this one.

## What was built (map)
Front end only. `backend/` is untouched (no back-end gaps found so far).

`frontend/features/workforce/payslips/` (index.ts exports the screens):
- `_shared/` types (`payslip-types.ts`), `services/payslip-http.ts` (the one door: adds `x-device-id` and `x-payslip-unlock`, clears the unlock on `UNLOCK_REQUIRED`, returns files as blobs), `payslip-services.ts` (one function per endpoint, `payslipReads` / `payslipWrites` / `payslipOthers` for HR and the Accountant), lib: `device-id`, `unlock-session` (token in memory only, idle check), `amount-pref` (hidden by default, per device and person, local storage), `pay-words`, `payslip-copy`, `routes`, `save-blob`; hooks `use-file-action` (Preparing, 10 s slow line, failure line, share); components `amount` (Amount, HiddenNote, EyeButton), `payslip-row`, `pdf-buttons` (Download, Share), `old-payslips-card`.
- `unlock/`: `PayslipGate` (wraps every page; relock after 60 s in background, on leaving, idle check; System Admin sees "Page not found"), `UnlockScreen` (locked rows plus code), `CodeBlock` (code, first-code setup, wrong, slowed), hooks `use-code-entry`, `use-relock`, lib `unlock-logic`.
- `home/` (S2 plus `YearCard`), `detail/` (S3/S11, `SectionTable`), `history/` (S4 plus `P9CardBlock`), `document/` (S5/S6 and the P9 view, `PayslipDocumentScreen`).

`frontend/features/workforce/casual/`:
- `_shared/` types, `services/casual-services.ts`, lib `casual-pay` (same maths as server: rate x minutes / 480, half up), `casual-words`, `draft-store` (offline draft, idempotency key, cached "My casuals", cached rate), `save-file`.
- `record/`: `CasualsScreen` (department choice, day stepper, last 3 days), `DayBody`, `WorkerCard`, `LineDrawer`, `WorkerPicker`, `NewCasualForm`, `SheetStatusBlock`, `LocalPreview` (offline draft preview), hook `use-day-sheet` (saved on phone first, retry on `online` and every 20 s, same key for same lines, newer edit during a save is kept, stale version refreshes with words).
- `approve/`: `ApproveScreen`, `ApprovalCard` (PIN dialog, send back, uses server total as `expectedTotal`), `SendBackDialog`, `VoidButton`, hook `use-decision` (words for each refusal code).
- `sheet/`: `SheetScreen` (workers, receipts with `ReceiptDialog`, void for approvers), `SheetDocumentScreen` (`?preview=1` is the draft with a disabled "Print after approval" and its reason).

Shared kit (`frontend/features/workforce/_shared/`): new `components/phone-screen.tsx` (moved from `timesheets/mine/`, now accepts figure nodes, `aside`, `trailing`, `desktopActions`; the four My time screens import it from the kit), `components/pdf-viewer.tsx` (pdfjs-dist 4.10.38 drawn to canvas, pinch, double tap, zoom buttons), `lib/pinch-zoom.ts`, `lib/role-words.ts` (`nameAndRole`), `PhoneDarkHeader` gained `figureSize`, `aside`, node figure; `use-workforce-permissions` now also returns `siteId` and `headOfDepartmentIds`; `capabilities.ts` gained `payslip.read_any`, `p9.generate`, `p9.confirm_format`, `audit.read.payslip_access` and the `headOfDepartmentIds` field; `notification-copy.ts` reworded 5 rows and added 4 (`casualPaySentBack`, `casualPayToPay`, `payslipCorrected`, `payslipOpenedByStaff`; table test now expects 44).

Routes (thin shells under `frontend/app/app/workforce/`): `my-payslips/` (layout with gate, page, `history`, `[id]`, `[id]/document`, `p9/[year]`) and `casuals/` (page, `approve`, `preview`, `[sheetId]`, `[sheetId]/document`).

Shared-file edits to list in the sub-module README for the orchestrator (lane 1 also edits some of these):
- `components/app/shell/nav-table.ts`: removed `notBuilt` from `wf-my-payslips`, `wf-staff-my-payslips` (roles now `[...SHIFT_STAFF, STORE_ATTENDANT]`) and `wf-head-casuals`; ADDED row `wf-casual-approve` ("Casual pay", `/app/workforce/casuals/approve`, roles MANAGER, STORE_MANAGER, DIRECTOR) right after `wf-head-casuals`; DELETED legacy row `staff-payslips`.
- `components/app/shell/nav-table.test.ts`: expectations updated for the above.
- `lib/route-access.ts`: two new blocks before the "Home of the floor staff" block (`my-payslips`: everyone but System Admin; `casuals`: heads, managers, HR, Accountant, Director).
- `features/workforce/_shared/lib/capabilities.ts`, `use-workforce-permissions.ts`, `notification-copy.ts`, `kit-logic.test.ts`, `index.ts`.
- `frontend/package.json` and `pnpm-lock.yaml`: added `pdfjs-dist`.
- Not touched: Home card registry (the Branch Manager's "Needs you" card is Segment 6).

## Choices session 1 made (put each in `docs/features/workforce/decisions-3-payslips-frontend.md` as: question, choice, why, what changing it takes)
1. Routes are under `/app/workforce/my-payslips` and `/app/workforce/casuals`, not the spec's `/app/payslips`, because `/app/payslips` is the live old page and the nav table already pointed at the new path. The old-payslip card links to `/app/payslips`.
2. Gate in the section layout: the locked list with the code is the first screen of every deep link; after unlock the home route jumps to the chosen payslip, a deep link stays put.
3. First-code setup is two inline fields on the code screen, not a dialog.
4. A refused read clears the in-memory unlock (`UNLOCK_REQUIRED` is 403), so the screen returns to the code. Unlock token is memory only, never storage.
5. The device id is made once and kept in local storage (visit-only if blocked).
6. Version 1 is requested with `?v=1` always; list and home links omit `v` so they follow the newest version.
7. "This wasn't me" link is not built: Activity on my record (Chapter 14) does not exist. The line reads "Opened by you just now." only.
8. Screen words that the states kit has no row for live in `payslips/_shared/lib/payslip-copy.ts` and `casual/_shared/lib/casual-words.ts`, not in `states-copy.ts` (that file's key set is pinned).
9. PDF viewer is canvas by pdfjs with a page counter inside the viewer (Paper puts "1 / n" in the header) plus zoom buttons for keyboard and screen readers.
10. Document name for the screen reader comes from the unaudited list, so one view records one opening.
11. Share is hidden unless the browser can share files (PD32). Desktop "Print or share" on the casual sheet opens the PDF in a tab when there is no share sheet.
12. Offline casual: lines are saved on the phone first; "New casual" needs a signal (ID check is the server's); picking from cached "My casuals" and the cached day rate work offline; preview offline is drawn on the phone (`/casuals/preview`); Send waits for signal.
13. Nav: floor staff and the Store Attendant lose the legacy "Payslips" link and get "My payslips" (moving a row from `oldHref` to `newHref`); the Accountant's legacy "My Payments" (`accountant-payments`) is left in place because that old page also holds payment details; a "Casual pay" row was added for approvers although Paper has none (the Home "Needs you" card is Segment 6). Flag all three to the owner.
14. Notification rows: reworded to the System Admin audience and no figures; `payRunPublished` and `payRunReopened` left for Payroll (lane 1); table grows from 40 to 44.
15. The "up to 3 days back" window is shown as a stepper; the server enforces it.
16. Beyond Paper (list in the final message): hidden-amount reading rules, wrong/slowed/first-code states, Preparing and failure lines, offline queue and saved marker, stale-sheet words, void and receipt dialogs, the Casual pay menu row, zoom buttons.

## Known weak spots to check first in the browser
- `PdfViewer`: the worker URL `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` under Next 14 webpack; confirm a page renders and no console error. If it fails, copy the worker to `public/` is NOT allowed by `cp`; use a Write of a tiny re-export or adjust the import.
- `useSearchParams` in `PayslipDetailScreen`, `PayslipDocumentScreen`, `SheetDocumentScreen`, `CasualsScreen`, `LocalPreview`: `pnpm build` may demand a Suspense boundary; add one in the route shell if so.
- `PhoneScreen` with a node `figure` and the doubled eye (phone bar plus desktop title row): check there is one visible eye per width.
- `use-day-sheet`: the recursive `flush` after a newer edit; test offline by toggling the network in the browser tools.
- 320 px wide and 200 % font on every new screen.
- The Casuals screen for a head with `casual.record`: the head must have a department in `headOfDepartmentIds`; find one with the Postgres MCP.

## Session 2 tasks, in order
1. Read the original brief, this file, then skim `payslips/README`-less folders by the map above (no README exists yet for either sub-module).
2. Run `pnpm test` (frontend) once to find any other failing test; fix only what the Segment 3 edits broke.
3. Start or confirm the lane stack. Run `backend/src/scripts/payslips-casual-proof.ts up` with `RATE_LIMIT_MAX=100000` (it changes PIN hashes and backs them up first; never overwrite an existing backup). Switch the lane's sites on as that script needs.
4. Browser walk at 390 wide (`http://lane2.localhost:3102`, password `password123`), chrome-devtools MCP, one screenshot beside Paper per screen only: staff login (code, wrong code in words, hidden amounts and eye, detail, year to date, history, Document view, a corrected payslip with Version 2 and "Replaced"); a department head (record casual pay, add a casual, offline then retry, send); the Branch Manager `bm.town@` (approve with PIN, send back, void); the cash holder and worker receipt; check HR, Accountant, Director and System Admin through the API against the spec permissions table; Accountant P9 format confirmation if the spec places it on a screen (it is API-only in the code so far: `payslipOthers.confirmP9Format` exists, no screen; decide and log it, build a small confirm card only if the spec places one).
5. Safety proof: a person on a site not on the new payslips sees the old-payslip card and nothing broken, and `/app/payslips` still works.
6. Add the remaining tests: a markup test for the code screen states, `use-day-sheet` is hard to test as a hook so test `draft-store` and the retry decision logic if you extract it, and a route-gate test file for `my-payslips` and `casuals` (add to `lib/route-access.workforce.test.ts` style).
7. Write the docs: `docs/features/workforce/decisions-3-payslips-frontend.md` (use the choices above plus new ones), READMEs for `payslips/` and `casual/` with the parity manifest (one line per screen, flag the browns and token substitutions from spec section 0) and the line-level shared-file changes, update `docs/features/workforce/README.md`, `docs/PROJECT_STATUS.md` and the ledger rows.
8. Gates once at the end: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`, size checks (files at most 350 lines, folders at most 12 files; `casual/record/components` has 7 files, `payslips/_shared/components` has 6).
9. Audit check: openings are recorded, no codes or pay figures in notifications or audit.
10. Cleanup: run the proof script `down`, switch every lane site off, stop the dev servers you started. Commit with explicit paths.
11. Final message in the required format. Stop for the owner.
