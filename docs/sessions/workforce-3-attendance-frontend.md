# Workforce slice 3 (Attendance): front-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree.

---

You are a tech lead on Wendo RMS building the **screens of Workforce slice 3: Attendance**: Chapter 6 "A day at work" (the staff phone) and Chapter 7 "Today board and fixing time" (the manager's desktop) of the approved Paper designs, against the **real back end that already exists** (C1 to C5, B1, B2, F1 to F3, L1, S1, S2; built and accepted). Do not edit `backend/` except small gaps inside `backend/src/modules/workforce/attendance/` (own commit labelled `fix(workforce-attendance):`, with tests; no migrations, and **never touch the legacy clock tables or services**).

### Why this slice is delicate
The new clock runs behind a **per-site switch that is off everywhere**. The legacy clock still runs the live floor. **Nothing you build may change what a floor staff member sees or can do on a site whose switch is off.** The phone clock card only appears for a person on a site with the switch on (the API's `GET /me` says `enabled`). Do not change where anyone lands after sign-in, and do not remove any legacy clock screen or route.

### The owner's direction
Pilot branch: **Nyeri Town**. The rota has **no publish step** (Paper's Chapter 5 was redrawn). Staff are told about shift changes by the server a few minutes after the manager stops editing.

### Where you work
- The lane worktree on branch **`feat/workforce-3-attendance-frontend`**. It already holds the kit, the frame, slices 1a and 1b, the Rota back end and screens, and the Attendance back end. Run `git branch --show-current` and confirm `frontend/features/workforce/rota/` and `backend/src/modules/workforce/attendance/` exist.
- Ports: front end `pnpm exec next dev -p 3101`, API on 4101 from this worktree's `backend/`. Run `migrate deploy` on the lane database if the attendance tables are missing (lane database only, never production). The lane's Redis may not be running: the API starts degraded and the auto-close job only runs with `START_BULLMQ_WORKERS=true`; start Redis for the lane if you need it. Logins (password `password123`): `hr@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `admin@wendo.test`; find a department head and a waiter or barista with the read-only Postgres MCP. To test the clock on a lane site, switch the site on as Director with `PUT /api/v1/workforce/attendance/switch {"siteId":"...","enabled":true}` and **switch it off again when you finish**.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs or scripts)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production.

### Finish everything; decide, don't hand back
Nothing may be left pending: every screen, state, test, README and ledger row in scope is complete and no gate is red (fix any lint error you meet).
- On a question the owner could answer, choose your recommendation, build it, and add a row to `docs/features/workforce/decisions-3-attendance-frontend.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked or the choice is expensive to reverse (anything that would change live floor behaviour).
- Your last message opens with the decisions table, then the 5-line recap.

### Speed and method (the owner's priority)
Assemble pages from the kit and the existing Workforce screens; they carry the look, hover, focus, motion and accessibility. **Do not re-verify them.**
- Use the kit's phone parts (`PhoneDarkHeader`, `TimerChip`, `PhoneHero`, `ClockCard`, `WeekBars`, `DayStrip`, `PhonePrompt`, `DayCard`, `TimeRow`), `PinField`, the "what changes" dialog, reason chips, the Undo toast, `AttentionRow`, KPI strip, `TwoLineRow`, `StatusPill`, `UnderlineTabs`, the States kit, and the frame's card registry. Build a new part only if Paper shows something none covers, and put it in the kit's `_shared/`.
- One Paper pass per screen (`get_jsx` and `get_computed_styles` on the screen frame). One screenshot beside Paper per screen (390 for phone, 1440 for desktop); fix visible differences. **No per-component or per-dialog audits; no automated pixel-diff, ever.**
- One keyboard run of each screen's main task; one test per new interactive component. In the browser walk only a staff login (phone), the Branch Manager and one refused role; check the others through the API against "Who sees what".
- Parity manifest: one line per screen. Skip any check unlikely to find a real problem.

### Keep the code tidy as you build
Files aim for 250 lines or fewer and never exceed 350 (tests 400); one main component per file; no catch-all `utils`/`helpers`; no folder over 12 files (group `attendance/clock/`, `attendance/board/`, `attendance/fixes/`, `attendance/switch/`); per sub-module `components/ hooks/ lib/ services/ types/` plus `index.ts`; `app/` pages are thin shells; never import another feature's internals. After each screen run the two size checks (five longest files, five fullest folders) and fix breaches before moving on.

### Keep the cost down
No subagents or Explore agents. Read only what is named; never re-read a file. While iterating run only the tests for what you changed; run the full suite, `pnpm lint` and `pnpm build` once at the end. Commit after each screen.

### Read first (only these parts)
1. `backend/src/modules/workforce/attendance/README.md` (endpoints C1 to S2, who sees what, the switch) and `docs/features/workforce/decisions-3-attendance-backend.md` (they shape the screens: the 120-second undo, the 15-minute auto-close, the shift-end prompt `headsUpFrom` and `autoCloseAt`, offline taps counted at the phone's own clock, a phone clock off by more than 10 minutes flagged, "clocked out by mistake" is **not** built (slice 4: show the person where to ask their manager), nobody fixes their own time, the legacy 409 `CLOCK_MOVED_TO_NEW_ATTENDANCE`). Request and response shapes: the validators and `attendance.types.ts` only.
2. `frontend/features/workforce/_shared/README.md` and `index.ts`; `frontend/features/workforce/home/README.md` (how a slice registers a card); `frontend/features/workforce/rota/README.md` (what the rota screens already expose, e.g. the grid and the print page); decisions files `decisions-1a-frontend.md`, `decisions-1b-frontend.md`, `decisions-2-rota-frontend.md` (rules that still apply: wire names say `organization`, no "she/her", Picker and PadNumberInput, no Enter-submits in dialogs, the signature rule).
3. `docs/features/workforce/chapter-1-ledger.md` (cards Attendance owns), `frontend/components/app/shell/nav-table.ts` (note `SHOW_SCHEDULE_LINKS`), `lib/route-access.ts`, `docs/UI_BUILD_RULES.md` (states, shells, §4a).
4. **Paper** (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · B. Schedule and time"; call `get_guide` with `paper-mcp-instructions` first): **Chapter 6 · A day at work** (node `19CE-0`, six phone steps) and **Chapter 7 · Today board and fixing time** (node `19ZT-0`, six steps). Read each live. Shared notifications (`19PW-0`) only for the wording of attendance notices.

### Scope
**In:**
1. **Phone, Chapter 6:** the clock card on the staff Home (phone Home style) with clock in and the 2-minute undo, the on-shift state with the 10-minute heads-up, the shift-end prompt (finish now, or stay on with a reason), leaving early with a reason, no signal and offline taps (queue locally with a client event id, show them as waiting, retry safely), the 15-minute auto-close state, and the prompt content for Waiter, Barista and Store Attendant. The shift pill and the job's primary action slots in the phone top bar (built empty by the frame) get the shift pill now. The week bars show hours so far.
2. **Today board, Chapter 7 (desktop):** the board on the Branch Manager's Home and its own page (who is on, late, not yet in, on leave shown as none until slice 5), a not-in person's drawer, clock in for someone (time and reason required), a phone-closed shift with the real finish, editing any day's clock event with a reason using the preview of before and after, the head's view (own departments only). Nobody fixes their own time: show the API's refusal in words.
3. **Lateness view** from L1 where Paper draws it (the lateness list or the person's day).
4. **The per-site switch screen:** Paper does not draw one. Build the simplest possible card for the Director and System Admin (a list of sites with an on/off toggle, the confirm "what changes" dialog saying the legacy clock stops answering for that site, and the open-clock-in refusal shown in words), in the kit's style, on an address under `/app/workforce/attendance/switch`. Link it only from the Director's Home or Settings area where it fits; list it under "Built beyond Paper".
5. **Navigation and Home:** register the Attendance-owned Home cards (clock card, Today board, Service team today, the Branch Manager board) and tick the ledger rows "data wired" (the ones that still depend on timesheets, leave or approvals stay "frame built"). Add the **Today board** menu row to `nav-table.ts`. **Show the floor-staff Home link and the Schedule rows only for a site whose switch is on**, using the API's `enabled` (so Nyeri Town sees them once switched on and every other site sees nothing new). Keep `SHOW_SCHEDULE_LINKS` replaced by this per-site rule, and keep `nav-table.test.ts` and the route-access tests green and extended. Do not change post-login landings.
6. Services, types, hooks and tests for every endpoint used; button visibility from the API's permissions, never role names; polling `GET /me` using `headsUpFrom` and `autoCloseAt` for the heads-up and the prompt (no push, sound or vibration unless the kit already has it).

**Out:** timesheets, overtime, "clocked out by mistake" requests, Report a problem, approvals (slice 4); leave data; payroll; any back-end change beyond small gaps; any change to a site whose switch is off.

### Gates and finish
- `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` all pass, **lint included**; size checks clean.
- **Prove the safety property:** with the switch off, sign in as a waiter and as the Branch Manager on that site and show that nothing new appears (no Home link, no clock card, legacy clock unchanged). Then one flow end to end on a lane site with the switch on: a staff member on the phone clocks in late, sees the heads-up, undoes inside the window, clocks out through the shift-end prompt; the Branch Manager sees the board change, clocks someone in for them with a reason, fixes a time with a preview and a reason; the Director switches the site off and the legacy clock works again. Confirm the audit entries. **Leave every lane site switched off at the end.**
- READMEs, parity manifest (one line per screen), ledger rows, and the status rows in `docs/PROJECT_STATUS.md` and `docs/features/workforce/README.md` updated.
- Final message: (1) decisions table, (2) 5-line recap, (3) beyond-Paper items, back-end fixes made, how the owner switches Nyeri Town on. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
