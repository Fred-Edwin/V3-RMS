# Workforce · Attendance (slice 3)

**Status:** back end built 18 Oct 2026 on branch `feat/workforce-3-attendance` (cut from `feat/workforce-2-rota`); not merged or pushed. No screens yet. Every choice is in [decisions-3-attendance-backend.md](../../../../../docs/features/workforce/decisions-3-attendance-backend.md).

## What it does

Chapters 6 and 7: staff clock in and out on today's rota entry, undo within two minutes, answer the shift-end prompt, and managers see the Today board and fix time. Lateness is computed as data (deductions are slice 4).

- **Clock** (`clock/`): one tap in and out, with a `clientEventId` so retries and double taps make one event, the delay-corrected moment for offline taps, the location check, a reason chip for leaving early, undo with a voiding correction.
- **Shift-end prompt** (`prompt/`): due state (not a notification) once the scheduled end passes; "Stay on" keeps a reason chip and estimate; the minute sweep closes unanswered prompts at the scheduled end (flagged) and clock-ins forgotten past midnight; leftovers by role.
- **My day** (`me/`): the phone's card: current shift and state, the live counter (server clock), undo window, week bars, next shift, notices for shifts the phone closed.
- **Today board** (`board/`): per person state, tiles, departments with heads, phone-closed shifts needing a look; "clock in for her".
- **Fixing time** (`fixes/`): edit, add or void a clock event with a required reason; preview shows the day before and after; history keeps every old value.
- **Lateness** (`lateness/`): minutes late and past grace per rostered shift, Nairobi time only.
- **Switch** (`switch/`): per-site on/off with the legacy hand-over, and the guard on the legacy clock routes.
- **Legacy** (`legacy/`): the only file that reads or inserts into the legacy clock tables.

## Endpoints (all `authenticate`, then `attachWorkforceSubject`, then `requireCapability`; never `requireRole`)

| # | Route | Capability | Notes |
|---|---|---|---|
| C1 | `GET /workforce/attendance/me` | `time.own` | `enabled:false` for a site still on the old clock. |
| C2 | `POST .../clock-in` | `time.own` | `{ clientEventId, rotaEntryId?, deviceAt?, sentAt?, latitude?, longitude? }`. 201 new, 200 retry. 409 `NOT_ROSTERED`, `CLOCK_NOT_OPEN`, `CLOCK_ALREADY_IN`, `SHIFT_ALREADY_DONE`, `SHIFT_OVER`, `ATTENDANCE_NOT_ENABLED`; 403 `CLOCK_OUTSIDE_GEOFENCE`; 400 `LOCATION_REQUIRED`, `CLOCK_TIME_INVALID`. |
| C3 | `POST .../clock-out` | `time.own` | As C2 plus `reasonCode`/`reason`; 409 `REASON_REQUIRED` before the scheduled end, `CLOCK_NOT_IN`. |
| C4 | `POST .../undo` | `time.own` | `{ clientEventId }`. 409 `UNDO_NOT_AVAILABLE`, `UNDO_EXPIRED`. |
| C5 | `POST .../shift-end` | `time.own` | "Stay on": `{ rotaEntryId, answer:'STAY_ON', reasonCode, estimateMinutes? }`. 409 `PROMPT_NOT_DUE`, `PROMPT_EXPIRED`. |
| B1 | `GET .../board?siteId&date` | `today.read` | Scope as the rota. |
| B2 | `POST .../clock-for` | `today.act` | `{ employeeId, type, at, reason }`, today only. |
| F1 | `GET .../day?employeeId&date` | `timesheet.read` | The person's day with every event and its status. |
| F2 | `POST .../fixes/preview` | `time.fix` | Writes nothing. |
| F3 | `POST .../fixes` | `time.fix` | `{ action: EDIT\|ADD\|VOID, employeeId, date, ..., reason }`. 409 `FIX_BREAKS_ORDER`, `EVENT_NOT_FOUND`, `PERIOD_CLOSED`; 400 `FIX_WRONG_DAY`, `FIX_IN_FUTURE`. |
| L1 | `GET .../lateness?from&to&siteId&employeeId&includeOnTime` | `timesheet.read` | Up to 62 days. |
| T1 | `GET .../time/month?employeeId&month&filter&page&pageSize` | `timesheet.read` | The Time tab (Schedule V1): a person's month, newest first, five summary figures, filter chips with counts, paging. A head has no `timesheet.read`, so no tab. |
| T2 | `GET .../time/tiles?employeeId` | `timesheet.read` | Overview tiles: On time (30 days incl. today), Overtime (approved this month); Leave left is "Not set". |
| S1 | `GET .../switch` | `today.read` | |
| S2 | `PUT .../switch` | `attendance.switch` | `{ siteId, enabled }`. 409 `OPEN_LEGACY_CLOCK_IN`. |

Out-of-scope reads and writes on another branch answer 404; a head outside their departments, or a role without the capability, 403. Nobody changes their own time (403 `CANNOT_CHANGE_OWN_TIME`).

## Who sees what

| Viewer | Own clock | Board | Clock for | Fix time | Lateness / day | Switch |
|---|---|---|---|---|---|---|
| Staff, Store Attendant, Accountant | yes | no | no | no | Accountant reads all | no |
| Department head | yes | own departments | own departments | no | own departments | no |
| Branch / Store Manager | no | own site | own site | own site | own site | no |
| HR Manager | no | all | no | all (and closed periods) | all | no |
| Director | no | all (read) | no | no | all | no |
| System Admin | no | all | all | all | all | yes |

## Schedule V1: the Time tab and the board's states (24 Oct 2026)

Spec: `docs/features/workforce/final-pass/design-notes-2-v1.md`; API: `docs/API_CONTRACT.md` section 48.

- **Time tab rules.** One load per read (shifts, clock events, rules per day, leave, overtime), never one read per day. A day is shown only when it proves something: a day with a clock-in, or, while the clock is on and from the day it was switched on (`attendance_site_switches.enabled_at`), a day off, leave, a rostered day ahead or an absence. Before the switch-on day, while the clock is off, for someone who does not clock, and outside the person's employment, only days with a clock-in appear (none for a person who does not clock). "Absent" is a rostered shift that is over with no clock-in and no approved leave.
- **Late** is the lateness report's test (past the grace time) and its minutes are minutes past the grace time, in the rows, the summary and `last30` alike. **Overtime** is `overtime_items.authorised_minutes` for `AUTO_AUTHORISED`, `APPROVED` and `APPROVED_PART`, read straight from the items (not only from approved months).
- **Board.** `readOnly`, `actions`, `clock`, `pastDay` and `fixedAfterTheDay` come from `board/board-mode.ts`. A past day is judged as it ended and has no `asOf`; `clock.whoCanSwitch` reads the access table. With the clock off the board answers without people but keeps On leave real.
- Out of scope here: Unaccounted items and the lateness actions (V3, V4), leave balances (section 7).

## The switch and rollback

Default is off: no row for a site means the legacy clock is authoritative and nothing changes. `PUT /workforce/attendance/switch {siteId, enabled}` (System Admin only, owner decision 18 Oct 2026; the Director cannot):

- **On:** refused (409) while anyone is clocked in on the old clock today; otherwise today's finished legacy records are carried as `LEGACY` events and the four legacy clock routes answer 409 for that site.
- **Off:** today's new-engine clocks that sit on a carried legacy assignment are inserted as legacy records (marked, so a later switch-on never carries them back); the legacy routes work again at once. Anyone whose shift exists only in the new rota is listed in `notMirrored`.

Asking for the state a site is in changes nothing. Past days stay on whichever engine recorded them. Migration `20261018143401_workforce_attendance`; prove it with `backend/scripts/proof/attendance-migration-proof.sh`. The HTTP end-to-end proof is `src/scripts/attendance-proof.ts up|down`.

## Layout

```
attendance/
  attendance.constants.ts  attendance.types.ts  attendance-audit.ts  attendance-scope.ts  attendance-routes.ts
  days/      day-model (pure), person-day (pure), day-rules, days-repository
  clock/     clock-rules (pure), clock-context, clock-in/out/undo services, clock-repository, validators, controller
  prompt/    shift-end-service, auto-close-service, leftovers (service, repository), alerts-repository
  me/        my-day-service, my-day-view (pure)
  board/     board-view (pure), board-service, clock-for-service, on-shift-now, repositories, validators, controller
  fixes/     fixes-plan (pure), fixes-service, history-service, period-lock, fields, validators, controller
  lateness/  lateness-service, validators, controller, legacy-lateness-finding.test.ts
  time-tab/  time-tab-view (pure), time-tab-service, time-tab-repository, validators, controller (Schedule V1)
  switch/    switch-service, switch-carry, switch-repository, legacy-clock-guard, controller
  legacy/    legacy-clock-repository
```

Tables: `clock_events` (append-only), `attendance_site_switches`, `shift_end_answers`.

**Existing files touched:** `_shared/workforce-access.ts` (+`time.fix`, `attendance.switch`) and test, `_shared/events.ts`, `_shared/audit/audit-actions.ts`, `_shared/workforce-request.d.ts` (new, replaces a namespace), `index.ts` (door), `workforce-layering.test.ts`, `routes/index.ts`, `routes/clock-routes.ts` (the guard, the only legacy change), `jobs/workers.ts` and `jobs/attendance-auto-close-job.ts`, the Prisma back-relations in `access.prisma`, `people.prisma`, `rota.prisma`, and the lint fixes in `audit-hash(.test).ts` and the two rules tests.

## Coupling

Reads the rota's entries and templates, the Rules store (`ATTENDANCE`, `LATENESS`, `WEEK_AND_BREAKS`), People (`tracks time`, heads), the time engine and the audit writer. Reads orders, prep tickets and dispatches for the prompt's leftovers. Slice 4 registers `setPeriodClosedCheck`; slice 5 fills `onLeave`.

## Tests

Unit: day model, clock rules (offline, wrong phone clock, early leave, location), fix rules, board, auto-close, validators. Routes: 44 cases. Database: `attendance-flow-db.test.ts` (14 flows). Time tab and board states (Schedule V1): `time-tab/time-tab-view.test.ts` (pure), `time-tab-validators.test.ts`, `board/board-mode.test.ts`, route cases in `attendance-routes.test.ts`, and `time-tab/time-tab-flow-db.test.ts` (8 flows: month, filter and paging, read-only Accountant, scope, does-not-clock, clock-off, tiles, past-day and clock-off board). Three-zone run: `pnpm test:workforce-tz`. The database flows run only when `DATABASE_URL` names a lane database; run them one file at a time (`vitest run --no-file-parallelism src/modules/workforce`), because the attendance flow adds legacy fixture rows that the rota flow's "legacy tables unchanged" check would otherwise see.
