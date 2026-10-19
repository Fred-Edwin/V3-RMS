# Workforce · Timesheets, overtime and requests (slice 4a, reworked by Segment 1A)

**Status:** slice 4a back end built 18 Oct 2026 (`feat/workforce-4a-timesheets`); **reworked 19 Oct 2026 by Segment 1A on `feat/workforce-1a-timesheets-backend`** to the owner's approved Chapter 12 (payroll and timesheets as one month-based feature, steps 02 to 12). Back end only; the screens are rebuilt by the next front-end session. Nothing pushed. Every 1A choice is in [decisions-1a-timesheets-backend.md](../../../../../docs/features/workforce/decisions-1a-timesheets-backend.md) (rows X1 to X36); the spec is [specs/1a-timesheets-spec.md](../../../../../docs/features/workforce/specs/1a-timesheets-spec.md); the 4a choices that still stand are in [decisions-4a-timesheets-backend.md](../../../../../docs/features/workforce/decisions-4a-timesheets-backend.md).

## What it does

The rota is the promise and the clock events are the fact (slice 3); **the timesheet is the approved truth payroll reads.** Timesheets exist only for branches whose attendance switch is on; every other branch has none and nothing here touches the legacy payslip or attendance code.

- **One month per site.** Calendar month, 1st to last day, Nairobi time (the Rules store's `timesheetPeriod`). Its state is **OPEN** (until the last day is over), **TO_APPROVE** (derived from 00:00 Nairobi the day after, never stored) or **APPROVED**. **Nothing closes by itself; there is no early close and no reopen.**
- **Approve the month** (`approval/`): the site's own manager (Branch Manager; Store Manager for the Central Store; the Director for the site the Director belongs to) approves once the month has ended, with their own PIN, when nothing is left to decide. One transaction locks the month, checks the figures the dialog showed, approves the days that only carried facts, freezes a snapshot, issues the document number `TSH-n`, audits it and emits `timesheets.month_approved`. After it, every clock fix, day decision and overtime decision answers `409 PERIOD_APPROVED` ("This month is approved. Ask HR to correct the payslip."), a new request goes to HR, and `getApprovedHours` returns the month's hours. Payroll stages (Calculated to Paid) belong to Segment 2; the extension point is `getApprovedHours`, the event and `approved_snapshot`.
- **Months and reads** (`months/`): the months list (newest first, the open month with hours "so far"), a month (KPIs for the whole month or a range, "needs you before approving" and its parts, rules used, other sites' approval, capabilities), its people (search, department, range, needs-a-look and late filters, sort, server paging), a person's drawer and a person's full month.
- **Days and weeks** (`days/`, `assemble/`): built from the rota and the clock events. A day that matches the rota approves itself. Late, left early, absent and edited days are recorded and never block; what does block is in `months/needs-you.ts`.
- **Overtime** (`overtime/`): a manager approves **all, part (steps of 5 minutes) or none**, with a reason for part or none, their PIN and the version the screen showed; the minutes authorised are stored and payroll decides pay. Evidence is counts only (never takings) and the limits are information. A department head may leave one line of note (evidence, never a decision).
- **Requests** (`requests/`): Report a problem and "clocked out by mistake"; the manager's inbox; escalation to HR after 3 days stays. A request about an approved month goes straight to HR.
- **Exports** (`exports/`): the month as a landscape **PDF** (grouped by department, 20 people on page 1, a department never split, signed style with QR and TSH number once approved, "Draft, not approved" before) and an **Excel** working copy (three sheets, real numbers, live sums). Audited, size and rate limited, never any pay figure.
- **Sweep** (`timesheets-sweep.ts`, `src/jobs/timesheets-sweep-job.ts`): every 10 minutes, Nairobi time: brings switched branches' current month up to date, refreshes months waiting for approval, escalates old requests. It closes nothing and never touches an approved month.
- **Hook** (`register-timesheets.ts`): the attendance fix door asks "is this day in an approved month?" and answers `PERIOD_APPROVED`.
- **Door**: `getApprovedHours(userId, period)` returns minutes from approved months only.

## Endpoints

Base `/api/v1/workforce/timesheets`. Every route: `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`; never `requireRole`. The full table is `docs/API_CONTRACT.md` §38.

| # | Route | Capability |
|---|---|---|
| MO1 to MO5 | `GET /months`, `/months/:monthKey`, `/months/:monthKey/people`, `.../people/:employeeId`, `.../people/:employeeId/days` | `timesheet.read` |
| MO6 | `POST /months/:monthKey/approve` | `timesheet.close` |
| MO7 | `POST /months/:monthKey/exports` | `timesheet.export` |
| T5, T6 | `GET /days/:id`, `POST /days/:id/decision` | `timesheet.read`; `timesheet.approve` or `manager_time.decide` |
| O1 to O4 | `GET /overtime`, `GET /overtime/:id`, `POST /overtime/:id/decision`, `POST /overtime/:id/note` | `timesheet.read`; `timesheet.read`; `overtime.approve` or `manager_time.decide`; `overtime.note` |
| R1 to R3 | `GET /requests`, `POST /requests/:id/decision`, `GET /requests/:id` | `timesheet.read`; `time_request.answer`; `timesheet.read` or `time.own` |
| R4 to R6 | `GET /me/requests`, `POST /me/requests`, `POST /me/requests/:id/withdraw` | `time.own` |
| M1, M2 | `GET /me/time`, `GET /me/rota` | `time.own` |

## Who sees what and does what

| Viewer | Reads | Decides days and overtime | Approves the month | Exports | Head's note |
|---|---|---|---|---|---|
| Staff | own time, rota, requests | no | no | no | no |
| Department head | no timesheet (their department's lateness and day history on the Today board) | no | no | no | own department |
| Branch Manager / Store Manager | own site | own site (not themselves) | own site | own site | no |
| HR Manager | all | no (answers requests) | no | all | no |
| Accountant | all | no | no | all | no |
| Director | all | a site manager's own days and overtime | the Director's own site (Head office) | no | no |
| System Admin | all | no (answers requests) | no | no | no |

Another site answers 404; a write without the capability, 403. Nobody decides their own day, request or overtime.

## Layout

```
timesheets/
  timesheets.types.ts  timesheets-audit.ts  timesheets-scope.ts  timesheets-routes.ts  timesheets-sweep.ts
  register-timesheets.ts  approved-hours.ts  approved-repository.ts
  months/     people-rows (pure), rules-used, month-context, month-data, months-service/-repository/-validators/-controller
    rules/    month-state (pure), needs-you (pure: what blocks approving), so-far (pure)
    people/   day-result (pure), person-day-facts (pure), person-month (a person's drawer and full month)
  approval/   approve-service, approval-validators, pin-check, pin-repository, decided-by (pure), snapshot (pure)
  exports/    export-plan (pure page planner), export-format (pure), export-model, export-model-service, exports-service,
              exports-repository, exports-validators, pdf-draw, pdf-render, xlsx-render
  periods/    period-window (pure), periods-repository
  days/       day-assess (pure), day-merge (pure), timesheet-days-repository, decide-service, person-service (a day's detail), weeks, validators, controller
  assemble/   assemble-plan (pure), assemble-load, assemble-service (the refresh)
  overtime/   overtime-plan (pure), overtime-repository, evidence-repository, overtime-service (list, decide), overtime-detail-service, overtime-note-service, validators, controller
  requests/   requests-rules (pure), clock-apply, day-snapshot, requests-service, request-decide-service, escalation-service, requests-repository, requests-view, validators, controller
  me/         me-service, me-clock-times, me-validators, me-controller
```

Tables: `timesheet_periods` (one row per site-month; now with the approval columns), `timesheet_days`, `timesheet_weeks`, `overtime_items` (now with `version` and `head_note`, status `APPROVED_PART`), `time_requests`, `timesheet_exports` (DATA_MODEL §12). Nothing stores money.

## Existing files touched by Segment 1A

`_shared/workforce-access.ts` and its test (the new table: `timesheet.export`, `overtime.note`, `time_request.answer`, `manager_time.decide`; `timesheet.reopen` deleted; HR, Accountant, System Admin and heads lose approving), `_shared/events.ts` (`timesheets.month_approved`), `_shared/audit/audit-actions.ts` (`month_approved`, `overtime_noted`, `exported`; the close, reopen and sign actions are retired but stay readable), `attendance/fixes/period-lock.ts` (`PERIOD_APPROVED`), `attendance/attendance-scope.ts`, `attendance/fixes/history-service.ts`, `attendance/lateness/lateness-service.ts` and `attendance/attendance-routes.ts` (a head keeps their department's reads via `today.read`), `attendance/attendance-flow-db.test.ts`, `src/jobs/timesheets-sweep-job.ts`, `prisma/schema/workforce/timesheets.prisma` and two migrations, `package.json` (`exceljs`, `qrcode`, `@types/qrcode`). The rules store's `timesheetCutoff` is no longer read.

## Coupling

Reads the rota's entries and templates and the attendance day model (`buildEntryDay`, `groupDay`), the Rules store (`LATENESS`, `OVERTIME`, `ATTENDANCE`, `WEEK_AND_BREAKS`), People (heads, departments, tracks-time), orders and prep tickets (counts, for overtime evidence), the time engine, the audit writer and the events door. Writes clock corrections only through `applyFix`. Segment 2 (payroll) reads approved hours through the door and the `timesheets.month_approved` event; slice 5 (leave) will fill `leaveDays`.

## Tests

Unit: month state (Nairobi versus UTC, February, a 31-day month), what blocks approving, "so far", the people table and KPI identities, a day's result, part-approved overtime, the decided-by wording, the snapshot hash, the page planner (20 on page 1, whole departments, over 26, rules and signature never split), the PDF (pages, A4 landscape, byte-identical re-export, draft versus signed) and the Excel (real numbers, formulas, frozen header), the period window, the assemble plan, route matrix (68 cases) and the access matrix. Database: `timesheets-flow-db.test.ts` (19 flows, runs only against a lane database, one file at a time). Three-zone run: `pnpm test:workforce-tz`. Proofs: `scripts/proof/timesheets-approval-migration-proof.sh` (migration on a copy) and `src/scripts/timesheets-proof.ts up|down` (the per-role HTTP proof and one end-to-end month with the seeded logins).
