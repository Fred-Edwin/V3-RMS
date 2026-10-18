# Workforce slice 2 (Rota): front-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree.

---

You are a tech lead on Wendo RMS building the **screens of Workforce slice 2: the Rota** (Chapter 5 of the approved Paper designs), against the **real back end that already exists** (13 endpoints, built and accepted). Do not edit `backend/` except small gaps inside `backend/src/modules/workforce/rota/` (own commit labelled `fix(workforce-rota):`, with tests; no migrations).

### The owner's direction (18 Oct 2026): no publish step
Paper's Chapter 5 was **redrawn without Publish**. Edits save at once and are live; staff are told once, a few minutes after the manager stops editing. A change to today or tomorrow asks for a reason (the dialog in step 5). **Build what Paper now shows, not what older documents say.** If a document mentions publish or draft for the rota, Paper and the back end win.

### Where you work
- The lane worktree on branch **`feat/workforce-2-rota-frontend`**. It already holds the kit, the frame, slices 1a and 1b (both ends) and the Rota back end. Run `git branch --show-current` and confirm `frontend/features/workforce/people/` and `backend/src/modules/workforce/rota/` exist.
- Ports: front end `pnpm exec next dev -p 3101`, API on 4101 from this worktree's `backend/`. Run `migrate deploy` on the lane database if the rota tables are missing (lane database only, never production). Logins (password `password123`): `hr@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `admin@wendo.test`; find a department head and a staff login with the read-only Postgres MCP.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk or scripts)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production.

### Finish everything; decide, don't hand back
Nothing may be left pending: every screen, state, test, README and ledger row in scope is complete and no gate is red (fix any lint error you meet, even in older code).
- On a question the owner could answer, choose your recommendation, build it, and add a row to `docs/features/workforce/decisions-2-rota-frontend.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked or the choice is expensive to reverse.
- Your last message opens with the decisions table, then the 5-line recap.

### Speed and method (the owner's priority)
Assemble pages from the kit and the 1a/1b screens; they carry the look, hover, focus, motion and accessibility. **Do not re-verify them.**
- The kit already has the shift palette, `ShiftChip`, `PickShiftButton`, `ShiftLegend`, `ShiftGrid`, `TwoLineRow`, `PeriodStepper`, KPI strip, `ChoiceChips`, `RadioCards`, reason chips, the "what changes" dialog, the Undo toast, `WorkforceDocument` (landscape A4), `DayStrip`. Use them. Build a new part only if Paper shows something none covers, and put it in the kit's `_shared/`.
- One Paper pass per screen (`get_jsx` and `get_computed_styles` on the screen frame). One screenshot at 1440 beside Paper per screen; fix visible differences. **No per-component or per-dialog audits; no automated pixel-diff, ever.**
- One keyboard run of each screen's main task; one test per new interactive component. In the browser walk only HR, Branch Manager and one refused role; check the others through the API against "Who sees what".
- Parity manifest: one line per screen. Skip any check unlikely to find a real problem.

### Keep the code tidy as you build
Files aim for 250 lines or fewer and never exceed 350 (tests 400); one main component per file; no catch-all `utils`/`helpers`; no folder over 12 files (group `rota/grid/`, `rota/templates/`, `rota/dialogs/`, `rota/phone/`); per sub-module `components/ hooks/ lib/ services/ types/` plus `index.ts`; `app/` pages are thin shells; never import another feature's internals. After each screen run the two size checks (five longest files, five fullest folders) and fix breaches before moving on.

### Keep the cost down
No subagents or Explore agents. Read only what is named; never re-read a file. While iterating run only the tests for what you changed; run the full suite, `pnpm lint` and `pnpm build` once at the end. Commit after each screen.

### Read first (only these parts)
1. `backend/src/modules/workforce/rota/README.md` (endpoints, who sees what, Decisions) and `docs/features/workforce/decisions-2-rota-backend.md` (they shape the screens: reason rule for today and tomorrow, override reason for leave, copy fills empty cells only, cost only for HR and the Director, `GET /week` returns the caller's whole scope so default to their own site and pass `siteId` for HR and the Director). Request and response shapes: `rota.types.ts` and the validators only.
2. `frontend/features/workforce/_shared/README.md` and `index.ts`; `frontend/features/workforce/people/README.md` and `decisions-1a-frontend.md` / `decisions-1b-frontend.md` (decisions that still apply: wire names say `organization`, no "she/her", Picker and PadNumberInput, no Enter-submits in dialogs); `frontend/features/workforce/home/README.md` (how a slice registers a card).
3. `docs/features/workforce/chapter-1-ledger.md` (cards Rota owns), `frontend/components/app/shell/nav-table.ts`, `lib/route-access.ts`, `docs/UI_BUILD_RULES.md` (states, shells, §4a).
4. **Paper** (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · B. Schedule and time", artboard **Chapter 5 · Build the rota**, node `14UM-0`): call `get_guide` with `paper-mcp-instructions` first. Steps: 01 the week grid, 02 set one shift (popover), 03 start from last week (preview dialog), 04 a warning that never blocks (on leave: reason chips), 05 a change for the next two days needs a reason (summary of who is told), 06 Shift templates, 07 add or edit a shift, 08 HR's rota (sites on the left, department filter), 09 department head on a phone, 10 printed rota. Read each live.

### Scope
**In:**
1. **Rota page (steps 1, 2, 5, 8):** department list with status, KPI strip (shifts, needs a look, hours planned, on leave), the week grid with the shift popover, brush and drag-fill, "Copy day", keyboard letters and Delete, the always-visible hours per person and people-per-day row, the "Saved just now" status that reflects autosave and its errors, the period stepper, past days read-only. HR and Director see sites on the left and a department filter (step 8); cost only where the API returns it.
2. **Warnings (step 4):** leave override with reason chips; clash, thin coverage, weekly hours and double shift shown but never blocking.
3. **Start from last week (step 3):** the preview dialog from the API, then copy; clashes shown, never copied.
4. **Near-term change reason (step 5):** the dialog for changes to today or tomorrow, listing who is told, with the required reason (3 to 200 characters), and the server's past-day refusal shown in its words.
5. **Shift templates (steps 6, 7):** list with filters and retire/restore; add and edit dialog (times, unpaid break with paid hours, colour, who can use it, departments); the "edit makes a new version if past days used the old times" behaviour explained in the dialog.
6. **Phone (step 9):** the department head's day-at-a-time view from Home, "Pick shift", the shift sheet, autosaving.
7. **Printed rota (step 10):** the landscape A4 document from the print data with `WorkforceDocument`; print styles.
8. **My shifts:** the staff member's upcoming shifts (`/mine`) where Paper draws them (Chapter 6 and My time may only reference it: build the data hook and a minimal list only if Paper shows one in this chapter).
9. **Navigation and Home:** add the **Schedule** group rows (Rota, Shift templates) to `nav-table.ts` with tests, but **hide them from every role behind a single flag** (default off) until Attendance (slice 3) moves the clock onto the new rota; reaching the pages by address works for permitted roles so the owner can review. Register the Rota-owned Home cards and tick the ledger rows "data wired" (the cards that depend on attendance stay "frame built").
10. Services, types, hooks and tests for every endpoint used; button visibility from the API's permissions, never role names.

**Out:** clock in and out, the Today board, timesheets, leave data (leave warnings return nothing until slice 5), notification delivery, any back-end change beyond small gaps.

### Gates and finish
- `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` all pass, **lint included**; size checks clean.
- One flow end to end in the browser on the lane database as a Branch Manager (the lane has few people on a rota: create what you need): create a template, build a week with the brush, copy to next week with a clash, change a shift for tomorrow with a reason, print; confirm the audit entry and the autosave status.
- READMEs, parity manifest (one line per screen), ledger rows, and the status rows in `docs/PROJECT_STATUS.md` and `docs/features/workforce/README.md` updated.
- Final message: (1) decisions table, (2) 5-line recap, (3) beyond-Paper items, back-end fixes made. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
