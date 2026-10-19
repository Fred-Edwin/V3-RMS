# Handover: Workforce 1A timesheets front end (lane 2)

Branch `feat/workforce-1a-timesheets-frontend`, lane 2 worktree. Ports: front end 3102, API 4102, browser http://lane2.localhost:3102. Brief: `docs/sessions/workforce-1a-timesheets-frontend.md` (override: lane 2, not lane 1). Spec: `docs/features/workforce/specs/1a-timesheets-spec.md`, `decisions-1a-spec.md`, `decisions-1a-timesheets-backend.md`.

**State: NOTHING IS COMMITTED, and NOTHING HAS BEEN TYPE-CHECKED OR RUN.** Run `pnpm exec tsc --noEmit` first and fix what it reports.

## Done (uncommitted, under `frontend/features/workforce/timesheets/`)
- `_shared/types/month-types.ts`, `_shared/services/month-services.ts` (reads, approve, overtime decision, file download), `_shared/hooks/use-month-data.ts`, `_shared/lib/month-words.ts` (KPI cells, status words, week picks, result words; no tests yet).
- `months/`: `components/` months-screen, month-head, months-list, people-table, range-control; `hooks/` use-month-url, use-departments, use-refresh-on-focus; `lib/month-pick.ts`.
- `approve/` (dialog + `approve-view.ts`), `exports/` (export dialog, `export-file.ts`).
- `overtime/` rewritten: new dialog, `lib/overtime-view.ts`.
- `person/`: person-drawer, need-look-card, last-days, day-fix, calendar-glance, days-table; `lib/person-view.ts`, `lib/days-view.ts`.
- Kit: `kpi-strip.tsx` got `tone: 'success'`; `capabilities.ts` dropped `timesheet.reopen`, added `timesheet.export`, `overtime.note`, `time_request.answer`, `manager_time.decide`.
- `git rm` done (staged) for `periods/`, `week/`, `report/`, old overtime components/lib, `app/app/workforce/timesheets/report/page.tsx`.

## Still to do
1. **Full-month screen (S5)**: `person/components/person-month-screen.tsx` plus route `app/app/workforce/timesheets/month/[monthKey]/[employeeId]/page.tsx` (use `useParams`). Uses `usePersonDays`, `CalendarGlance`, `DaysTable`, `rowAction`, FilterChips (All days / Needs a look / Worked), prev/next person (`neighbours`, disabled at the ends), `ExportMenu` with `person`, crumb back to `/app/workforce/timesheets?month=&site=&from=&to=`.
2. `app/app/workforce/timesheets/page.tsx` must render `MonthsScreen` (it still imports the deleted `TimesheetsScreen`); fix `timesheets/index.ts` exports (remove `TimesheetsScreen`, `ReportScreen`; export `MonthsScreen`, `PersonMonthScreen`).
3. Delete from `_shared/services/timesheet-services.ts` and `_shared/types/timesheet-types.ts` the removed endpoints and types (periods, period, person, report, sign, close, reopen, decideDay, old overtime decision). `home/cards/timesheet-data.ts` still calls `timesheetReads.periods` and `p.cutoffAt` (route gone): switch it to `monthReads.list` and drop or reword the "Timesheets close" events.
4. Nav: `components/app/shell/nav-table.ts`: `wf-timesheets` roles to Branch Manager and Store Manager only; remove `wf-head-timesheets`; add a Director row "Head office timesheets" (to `/app/workforce/timesheets`, the page opens on the Director's own site); remove the `/timesheets/report` bare-route regex in `isBareRoute`; extend `nav-table.test.ts` and `lib/route-access*.test.ts`. List it under "Built beyond Paper".
5. Requests wording and the phone wording (spec section 9): Report a problem goes to the Branch Manager; approved month says "Tell HR".
6. Tests: month-words, month-pick, approve-view, overtime-view, person-view, days-view, one per new interactive component (static markup).
7. Docs: `docs/features/workforce/decisions-1a-timesheets-frontend.md` (question, choice, why, what changing it takes), timesheets READMEs per sub-module (months, person, approve, exports, overtime), parity manifest, `docs/PROJECT_STATUS.md`, Workforce README, `_shared/README.md` (kpi tone, capabilities).
8. Gates: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`; size checks (250/350 lines).
9. Browser flow on lane 2 (Branch Manager, HR refused); switch the lane site on as System Admin and **switch it off again**.
10. Final message: decisions table, 5-line recap, beyond-Paper items. No next-session prompt.

## Decisions to log (made so far)
Export is a dialog, not a popover (no popover primitive); PDF downloads directly (no Document view yet); no background export job (the back end is synchronous); week quick picks are a Picker beside the range picker; Excuse button not built (day rows carry no day id); "Answer the request" goes to the Requests inbox; people-table header sorting not built (the shared table has none); default month looks only at the first page of months; drawer is the kit's 480 px not 500; "Edited by a manager" because the read gives only an id; evidence failure shows an error, since the decision needs the item's version.

## Gotchas
Wire name: the month read's `site` arrives as `organization`; months reads take query `site`, older lists take `siteId`. The people table owns URL keys `q`, `page`, `perPage`, `view`, `dept`; the page owns `site`, `month`, `from`, `to`, `person`. Edit and Write tools only, a `Why:` line before each.
