# Workforce slice 4a follow-up: timesheet period becomes the calendar month (back end)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 2 worktree.

---

You are a tech lead on Wendo RMS. The Timesheets back end (slice 4a, branch `feat/workforce-4a-timesheets`) is built and accepted. The owner has now decided (19 Oct 2026): **a timesheet period is one calendar month** (1st to last day, Nairobi time), not four whole weeks. Change the back end to match. **Back end only. No frontend, no `nav-table.ts`, no legacy tables.** Nothing pushed.

### Where you work
Lane 2 worktree, branch `feat/workforce-4a-timesheets` (continue on it; run `git branch --show-current` first). Ports: API 4102, own lane database. `CLAUDE.md` applies in full: pnpm only; no `any`; Edit and Write tools only (never sed, awk, heredocs, scripts); one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; recap of about 5 lines at the end. No subagents; read only what is named; never re-read a file; run only the tests of what you change, then the full suite and `pnpm build` once at the end.

### The owner's decision and what follows from it
1. **Period = calendar month.** Add a rule kind `CALENDAR_MONTH` to `WEEK_AND_BREAKS.timesheetPeriod` and make it the default. Keep `FIXED_WEEKS` parseable so stored rules stay valid, but nothing in the UI or default uses it.
2. **Cut-off.** A month's period closes by itself at **18:00 Nairobi on the 2nd day after the month ends** (so October closes on 2 Nov at 18:00), so the last days are complete when a manager reviews. This **replaces decision T2** (days after the cut-off belong to the next timesheet). Under a calendar month no day moves between periods. Change `timesheetCutoff` to `{ daysAfterPeriodEnd: 2, time: '18:00' }` with a parse default so stored rules stay valid. Update `period-window.ts` and its tests (include a Nairobi-vs-UTC month-boundary case: 00:30 Nairobi on 1 Nov is still 31 Oct in UTC).
3. **Part weeks.** A week that straddles two months shows in each period with only that period's days and is labelled a part week in the data. **Weekly rules (weekly overtime cap, rest, week-and-breaks) still look at the whole Monday to Sunday week**, including days in the neighbouring period (read-only for the other period). Decide which period an overtime item belongs to (recommendation: the period of the day on which the cap was crossed) and log it.
4. **Existing data.** Any open period already created on the lane database for a four-week window must be re-cut to the calendar month without losing days, requests or exceptions (an additive migration or a guarded re-cut step; prove it on a copy: legacy tables identical, second run changes nothing). Closed periods are never changed; if a closed four-week period exists, keep it and start the month periods after it.
5. **Everything else stays.** Auto-approval, exceptions, overtime evidence, close early, reopen (HR only, with a reason), the PIN sign-off, Report a problem, My requests, escalation after 3 days, visibility per role, and the period-closed hook for attendance fixes.

### Finish everything; decide, don't hand back
Nothing pending. On any question the owner could answer, choose your recommendation, build it, and add a row to `docs/features/workforce/decisions-4a-timesheets-backend.md` (*question, choice, why, what changing it takes*); mark T2 as superseded there. Your final message opens with the decisions table, then the 5-line recap, then existing files touched.

### Tidy and proof
Files aim for 250 lines or fewer, never over 350 (tests 450); no folder over 12 files; no catch-all utils. Size checks after each step. Gates: `cd backend && pnpm build && pnpm test`, the three time-zone runs, `pnpm check:imports` not worse than your recorded baseline, ESLint clean on all Workforce code. One HTTP proof with a real login (HR, Branch Manager, a waiter) on the lane database: a month period is created for a switched-on lane site, a day on the 1st and a day on the last land in it, a part week reads the neighbouring days for the cap, the period closes at 18:00 on the 2nd after month end (run the sweep directly if Redis is down), a fix is refused, HR reopens with a reason. Switch the site off and tear the proof data down.

### Docs
Update `timesheets/README.md`, `decisions-4a-timesheets-backend.md`, `docs/DATA_MODEL.md` and `docs/API_CONTRACT.md` where they mention the four-week period or the T2 rule, and the Workforce README status row. Do not draft the next session's prompt. Stop for the owner's review.
