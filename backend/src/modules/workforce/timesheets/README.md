# Workforce · Timesheets, overtime and requests (slice 4a)

**Status:** back end built 18 Oct 2026 on branch `feat/workforce-4a-timesheets` (cut from `feat/workforce-3-attendance`); not merged or pushed. Screens built 19 Oct 2026 on `feat/workforce-4a-timesheets-frontend` (`frontend/features/workforce/timesheets/`), with three small additions made there and recorded in [decisions-4a-timesheets-frontend.md](../../../../../docs/features/workforce/decisions-4a-timesheets-frontend.md): a person's days (T4) and My time's days (M1) carry `clockIn` and `clockOut`, and the period read (T2) takes `from` and `to`. Every back-end choice is in [decisions-4a-timesheets-backend.md](../../../../../docs/features/workforce/decisions-4a-timesheets-backend.md).

## What it does

Chapters 8 and 9. The rota is the promise and the clock events are the fact (slice 3); **the timesheet is the approved truth payroll reads.** Timesheets exist only for branches whose attendance switch is on; every other branch has none and nothing here touches the legacy payslip or attendance code.

- **Periods** (`periods/`): one per branch, one calendar month each (1st to last day, Nairobi time; the Rules store's `timesheetPeriod`, `CALENDAR_MONTH` by default). The current period is created on first read. It closes by itself at 18:00 Nairobi on the 2nd day after the month ends (October closes on 2 Nov), or a manager closes it early on its last day or after. A week that straddles two months shows in each period with its own days only and is flagged `partWeek`; the weekly overtime cap still reads the whole Monday to Sunday week, including the neighbouring period's days (read-only). Decisions M1 to M9; open items move to the next period for HR. HR reopens with a reason. The report (TSH-000n) is signed by the manager with their PIN.
- **Days and weeks** (`days/`, `assemble/`): built from the rota and the clock events. A day that matches the rota within the grace approves itself; so does a week of matched days; everything else is an exception with reasons. A manager accepts, excuses lateness or holds a day; a decision stays only while the evidence under it is the same.
- **Overtime** (`overtime/`): evidence (counts) and limits (weekly cap, branch budget); the service tail is recognised by itself when there was open work at the end. Approving authorises the time; payroll decides pay.
- **Requests** (`requests/`): Report a problem and "clocked out by mistake" with before and after; the manager's inbox; accepting a clock request makes the correction through the attendance fix door; unanswered for 3 days it moves to HR.
- **Report** (`report/`): the landscape report data. **Me** (`me/`): My time and My rota for the phone.
- **Sweep** (`timesheets-sweep.ts`, `src/jobs/timesheets-sweep-job.ts`): every 10 minutes, Nairobi time: brings switched branches up to date, closes periods past their cut-off, escalates old requests. Idempotent; each step claims what it moves.
- **Hook** (`register-timesheets.ts`): a closed period refuses attendance fixes (`PERIOD_CLOSED`); HR reopens first.
- **Door**: `getApprovedHours(userId, period)` returns approved minutes only.

## Endpoints

Base `/api/v1/workforce/timesheets`. Every route: `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`; never `requireRole`. The full table is `docs/API_CONTRACT.md` §38.

| # | Route | Capability |
|---|---|---|
| T1, T2, T4, T5 | `GET /periods`, `/periods/:id`, `/periods/:id/people/:employeeId`, `/days/:id` | `timesheet.read` |
| T6 | `POST /days/:id/decision` | `timesheet.approve` |
| O1, O2 | `GET /overtime`, `POST /overtime/:id/decision` | `timesheet.read`, `overtime.approve` |
| P1 to P4 | `GET /periods/:id/report`, `POST .../sign`, `.../close`, `.../reopen` | `timesheet.read`, `timesheet.close`, `timesheet.close`, `timesheet.reopen` |
| R1 to R3 | `GET /requests`, `POST /requests/:id/decision`, `GET /requests/:id` | `timesheet.read`, `timesheet.approve`, `timesheet.read` or `time.own` |
| R4 to R6 | `GET /me/requests`, `POST /me/requests`, `POST /me/requests/:id/withdraw` | `time.own` |
| M1, M2 | `GET /me/time`, `GET /me/rota` | `time.own` |

## Who sees what

| Viewer | Reads | Decides days, overtime, requests | Closes, signs | Reopens |
|---|---|---|---|---|
| Staff (own clock) | own time, rota, requests | no | no | no |
| Department head | own departments | own departments (overtime inside the allowance) | no | no |
| Branch / Store Manager | own branch | own branch | yes | no |
| HR Manager | all | all | yes | **yes** |
| Director, Accountant | all | **no** | no | no |
| System Admin | all | all | yes | no |

Another branch answers 404; a write without the capability, 403. Nobody decides their own day or request.

## Layout

```
timesheets/
  timesheets.types.ts  timesheets-audit.ts  timesheets-scope.ts  timesheets-routes.ts  timesheets-sweep.ts
  register-timesheets.ts  approved-hours.ts  approved-repository.ts
  periods/    period-window (pure), period-view (pure), periods-service/-repository/-validators/-controller,
              close-service, reopen-service (reopen and sign), pin-repository
  days/       day-assess (pure), day-merge (pure), timesheet-days-repository, decide-service, person-service, weeks, validators, controller
  assemble/   assemble-plan (pure), assemble-load, assemble-service (the refresh)
  overtime/   overtime-plan (pure), overtime-repository, evidence-repository, overtime-service, validators, controller
  requests/   requests-rules (pure), clock-apply, day-snapshot, requests-service, request-decide-service, escalation-service,
              requests-repository, requests-view, validators, controller
  report/     report-service, report-controller        me/   me-service, me-clock-times (a day's clock times), me-validators, me-controller
```

Tables: `timesheet_periods`, `timesheet_days`, `timesheet_weeks`, `overtime_items`, `time_requests` (DATA_MODEL §12). Nothing stores money.

## Existing files touched

`_shared/workforce-access.ts` (+`timesheet.close`, `timesheet.reopen`) and its test, `_shared/events.ts`, `_shared/audit/audit-actions.ts`, `rules/rules-schemas.ts`, `rules-defaults.ts`, `rules-field-policy.ts` (the `timesheetCutoff` field), `attendance/fixes/period-lock.ts` (HR no longer passes a closed period), `index.ts` (door), `workforce-layering.test.ts`, `src/routes/index.ts`, `src/jobs/workers.ts`, the Prisma back-relations in `access.prisma` and `people.prisma`, and `package.json` (the time-zone script covers the pure timesheet folders).

## Coupling

Reads the rota's entries and templates and the attendance day model (`buildEntryDay`), the Rules store (`LATENESS`, `OVERTIME`, `ATTENDANCE`, `WEEK_AND_BREAKS`), People (heads, tracks-time), orders and prep tickets (counts, for overtime evidence), the time engine, the audit writer and the events door. Writes clock corrections only through `applyFix`. Slice 5 (leave) and slice 6 (payroll) read approved hours through the door.

## Tests

Unit: period window (including Nairobi versus UTC), day assessment, merge, refresh plan (a week with a late day and an overtime day; a second run changes nothing), overtime limits, request rules and escalation, clock-correction plans, period view, route matrix (60 cases). Database: `timesheets-flow-db.test.ts` (12 flows, runs only against a lane database, one file at a time). Three-zone run: `pnpm test:workforce-tz`. Proofs: `scripts/proof/timesheets-migration-proof.sh` and `src/scripts/timesheets-proof.ts up|down` (71 checks over HTTP with the seeded logins).
