# Workforce slice 4a (Timesheets, overtime, My time, requests): front-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree. **Do not start before the orchestrator has accepted the calendar-month back-end follow-up and prepared the branch** (see "Where you work").

---

You are a tech lead on Wendo RMS building the **screens of Workforce slice 4a**: Chapter 8 "Timesheets and overtime" (desktop) and Chapter 9 "My time and Report a problem" (phone) of the approved Paper designs, against the **real back end that already exists** (built and accepted). Do not edit `backend/` except small gaps inside `backend/src/modules/workforce/timesheets/` (own commit labelled `fix(workforce-timesheets):`, with tests; no migrations; **never touch legacy tables or services**).

### Owner decisions that shape the screens
- **A timesheet period is one calendar month** (1st to last day, Nairobi time). It closes by itself at 18:00 on the 2nd day after the month ends (October closes Monday 2 November). A week that straddles two months appears in each month as a **part week** with only that month's days. Paper's Chapter 8 text was updated to say so ("October 2026 · closes by itself on Monday 2 November, 18:00"). The sample figures in Paper (127 days, 1,046 h and so on) are sample data only; show real figures.
- The rota has **no publish step**. Pilot branch: Nyeri Town. A site whose attendance switch is off has **no timesheets**: show nothing new for it.
- Closed periods refuse every clock fix, HR included, until HR reopens the period with a reason (the API answers `PERIOD_CLOSED`; show it in words).
- Nobody changes their own time or decides their own request.

### Where you work
- The lane worktree on branch **`feat/workforce-4a-timesheets-frontend`**, prepared by the orchestrator by merging the Attendance screens branch and the Timesheets back-end branch. Run `git branch --show-current` and confirm `frontend/features/workforce/attendance/` and `backend/src/modules/workforce/timesheets/` both exist, and that the period rule is `CALENDAR_MONTH`. If not, stop and say so.
- Ports: front end `pnpm exec next dev -p 3101`, API on 4101 from this worktree's `backend/`. Run `migrate deploy` on the lane database if the timesheet tables are missing (lane database only). Redis may be down: run the sweep directly if you need a close or an escalation. Logins (password `password123`): `hr@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `admin@wendo.test`; find a department head and a waiter or barista with the read-only Postgres MCP. To get timesheets on a lane site, switch the site on as System Admin (`PUT /api/v1/workforce/attendance/switch {"siteId":"...","enabled":true}`) and **switch it off again when you finish**.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs or scripts)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production.

### Finish everything; decide, don't hand back
Nothing may be left pending: every screen, state, test, README and ledger row in scope is complete and no gate is red (fix any lint error you meet).
- On a question the owner could answer, choose your recommendation, build it, and add a row to `docs/features/workforce/decisions-4a-timesheets-frontend.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked or the choice is expensive to reverse.
- Your last message opens with the decisions table, then the 5-line recap.

### Speed and method (the owner's priority)
Assemble pages from the kit and the existing Workforce screens; they carry the look, hover, focus, motion and accessibility. **Do not re-verify them.**
- Use the kit: KPI strip, `TwoLineRow`, `AttentionRow`, `StatusPill`, `UnderlineTabs`, the table kit (search and filters first, numbered pager), `PinField`, the "what changes" dialog, reason chips, `Picker`, `PadNumberInput`, the phone parts (`PhoneDarkHeader`, `PhoneHero`, `DayCard`, `TimeRow`, `WeekBars`), the States kit, and the frame's card registry. Build a new part only if Paper shows something none covers, and put it in the kit's `_shared/`. Reuse the Attendance day view and fix preview rather than rebuilding them.
- One Paper pass per screen (`get_jsx` and `get_computed_styles` on the screen frame). One screenshot beside Paper per screen (390 for phone, 1440 for desktop); fix visible differences. **No per-component or per-dialog audits; no automated pixel-diff, ever.**
- One keyboard run of each screen's main task; one test per new interactive component. In the browser walk only the Branch Manager (desktop), a staff login (phone) and one refused role; check HR, Director, Accountant and a department head through the API against "Who sees what".
- Parity manifest: one line per screen. Skip any check unlikely to find a real problem.

### Keep the code tidy as you build
Files aim for 250 lines or fewer and never exceed 350 (tests 400); one main component per file; no catch-all `utils`/`helpers`; no folder over 12 files (group `timesheets/periods/`, `timesheets/week/`, `timesheets/overtime/`, `timesheets/report/`, `timesheets/requests/`, `timesheets/mine/`); per sub-module `components/ hooks/ lib/ services/ types/` plus `index.ts`; `app/` pages are thin shells; never import another feature's internals. After each screen run the two size checks (five longest files, five fullest folders) and fix breaches before moving on.

### Keep the cost down
No subagents or Explore agents. Read only what is named; never re-read a file. While iterating run only the tests for what you changed; run the full suite, `pnpm lint` and `pnpm build` once at the end. Commit after each screen.

### Read first (only these parts)
1. `backend/src/modules/workforce/timesheets/README.md` (endpoints, who sees what, the sweep) and `docs/features/workforce/decisions-4a-timesheets-backend.md` (T1 to T10 and the calendar-month rows; T2 is superseded). Request and response shapes: the validators and types files only.
2. `frontend/features/workforce/_shared/README.md` and `index.ts`; `frontend/features/workforce/home/README.md` (how a slice registers a card); `frontend/features/workforce/attendance/README.md` (the day view and fix preview you reuse); decisions files `decisions-1a-frontend.md`, `decisions-1b-frontend.md`, `decisions-2-rota-frontend.md`, `decisions-3-attendance-frontend.md` (rules that still apply: wire names say `organization`, no "she/her", Picker and PadNumberInput, no Enter-submits in dialogs, the signature rule, the per-site switch rule).
3. `docs/features/workforce/chapter-1-ledger.md` (cards Timesheets owns), `frontend/components/app/shell/nav-table.ts`, `lib/route-access.ts`, `docs/UI_BUILD_RULES.md` (states, shells, §4a).
4. **Paper** (file `01M3TP8J54R83RHC9FJ7RAHGKG`; call `get_guide` with `paper-mcp-instructions` first): page "Workforce · B. Schedule and time", **Chapter 8 · Timesheets and overtime** (node `1BFJ-0`, five steps, the last is the landscape report) and **Chapter 9 · My time and Report a problem** (node `1CG5-0`). Read each step live. Shared notifications (`19PW-0`) only for the wording of timesheet notices.

### Scope
**In:**
1. **Timesheets page (Chapter 8, desktop):** period header in calendar-month wording with the cut-off, the KPI strip, search and filters (Needs a look, Late, All), the people table with what needs you, the week picker (a part week is labelled), Approve all clean days, Export, and **Close early** with its dialog (what is left out and goes to HR). Branch Manager and Store Manager for their site; HR and Director read all sites with a site picker; the Accountant reads and acts on nothing; a department head sees their department.
2. **A person's week and day:** the days with the system's own approvals, the exception to decide (approve, hold, decide with a reason), overtime with its evidence and limits (approving only authorises the time; never show pay figures), reusing the Attendance day view for fixes.
3. **Overtime decisions:** approve or decline with the evidence, from the exception list and from the person's week.
4. **The closed timesheet and report (TSH-n):** the landscape report on screen and a print page like Paper's, the manager's PIN sign-off after the close, the Accountant's receipt, and HR's **Reopen with a reason**. A closed period shows every edit control as read-only with the reason in words.
5. **Requests (manager side):** the inbox of Report a problem and "clocked out by mistake" requests with before and after, answer (approve or decline with a reason; approving a clock-out request creates the linked correction through the API), and the escalation to HR after 3 days shown as such.
6. **Phone, Chapter 9:** **My time** (hours this month, each day with its status), **Report a problem** (pick the day and what it should be, with a reason; withdraw), **My requests** (waiting, escalated to HR, answered with before and after), and **My rota** if Paper draws it. In the Attendance phone clock card, replace the "ask your manager" note about a mistaken clock-out with a link to Report a problem.
7. **Navigation and Home:** add the Timesheets, Requests, My time and My requests rows to `nav-table.ts` (rows move `oldHref` to `newHref`), shown **only for a site whose attendance switch is on** (the same per-site rule the Attendance session built). Register the Timesheets-owned Home cards and tick the ledger rows "data wired" for those that now have data (the ones that depend on leave, payroll or Waiting for you stay "frame built"). Extend `nav-table.test.ts` and the route-access tests. Do not change post-login landings.
8. Services, types, hooks and tests for every endpoint used; button visibility from the API's permissions, never role names.

**Out:** Rules screens and Waiting for you (Groups D and E are not approved); leave data (show none until slice 5); payroll and payslips; notification delivery; any back-end change beyond small gaps; any change to a site whose switch is off.

### Gates and finish
- `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` all pass, **lint included**; size checks clean.
- **Prove the safety property:** with the switch off, sign in as a waiter and as the Branch Manager on that site and show that nothing new appears. Then one flow end to end on a lane site with the switch on: the Branch Manager sees only exceptions, decides one with a reason, approves overtime, closes early; a staff member reports a problem on the phone and the manager answers with before and after; HR cannot fix a closed period, reopens it with a reason; the report prints and the manager signs with a PIN. Confirm the audit entries. **Leave every lane site switched off at the end.**
- READMEs, parity manifest (one line per screen), ledger rows, and the status rows in `docs/PROJECT_STATUS.md` and `docs/features/workforce/README.md` updated.
- Final message: (1) decisions table, (2) 5-line recap, (3) beyond-Paper items and back-end fixes made. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
