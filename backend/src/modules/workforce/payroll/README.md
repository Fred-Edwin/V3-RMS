# Workforce · Payroll (Segment 2A, part 1)

**Status:** back end built 20 Oct 2026 on `feat/workforce-2a-payroll-backend` (not pushed, awaiting the owner's review). Part 1 covers the month, the engine, the review and the approval. Part 2 adds publish, corrections, the bank file, Mark as paid, exports and payslip numbers. Spec: `docs/features/workforce/design-pass-3-payroll.md`. Decisions: `docs/features/workforce/decisions-2a-payroll-backend.md`. HTTP proof: `docs/features/workforce/payroll-2a-http-proof-output.txt`.

## What it does

One payroll month per company per calendar month (Nairobi). It waits (`WAITING`) until the included sites' timesheet months are approved and the Accountant has confirmed the statutory tables, then the system calculates every payslip (`IN_REVIEW`). HR checks the unusual lines, leaves people out, adds lines with a PIN, and sends it to the Accountant (`TO_APPROVE`). The Accountant approves with a PIN (never the person who prepared it) and the figures freeze with a hash (`TO_PUBLISH`).

- Money is bigint cents inside the engine and `Decimal(14,2)` in the database; never a float.
- Runs, payslips, payslip lines and snapshots are insert-only (database trigger). Every recalculation is a new run.
- Every write carries an idempotency key and the `stateVersion` the screen showed; a stale one answers `409 CHANGED_UNDERNEATH`.
- Every change goes through the audit writer in the same transaction. No PIN and no pay figure is ever written to an audit entry.
- Only sites with the attendance switch on and a covered month are in the new payroll; the old payslip run refuses them with `409 PAID_IN_NEW_PAYROLL`.

## Folders

| Folder | What lives there |
|---|---|
| `engine/` | Pure payslip and month maths (earnings, statutory tables, review flags, totals). 41 unit tests with hand-worked cases. No database. |
| `estimate/` | The Director's estimate of the open month (pure estimator, service, nightly store). |
| `months/` | The calendar, the stage line, the months list and one month, the "waiting" banner. |
| `calculate/` | Loads the month's inputs, maps Rules to the engine, calculates a run, the sweep entry point. |
| `review/` | The review list, tick, tick a kind, Calculate again, leave out, add and remove a line. |
| `approval/` | Send, send back, approve (PIN, hand check, expected totals), the preparers list, the frozen snapshot. |
| `sites/` | Which site waits, remind a site, the Director's late approval. |
| `reads/` | The tabs (rules applied, tax, casual, totals) and the payslips list and detail. |
| `rollout/` | The guard the old payslip run asks, and the rules for who is covered. |
| `payroll-routes.ts`, `register-payroll.ts`, `payroll-sweep.ts` | Wiring; the job is `src/jobs/payroll-sweep-job.ts`. |

## Endpoints

Base `/api/v1/workforce/payroll`. Full table: `docs/API_CONTRACT.md` §40.

| # | Route | Capability |
|---|---|---|
| P1 to P8 | `GET /months`, `/months/:monthKey`, `.../rules-applied`, `.../tax`, `.../casual`, `.../totals`, `.../payslips`, `.../payslips/:id` | `payroll.read` |
| P9 | `GET .../estimate` | `payroll.estimate.read` |
| P10 | `GET .../review` | `payroll.read` |
| P11 to P16 | `POST .../recalculate`, `.../review/:lineId/check`, `.../review/check-kind`, `.../review/:lineId/leave-out`, `.../adjustments`, `DELETE .../adjustments/:id` | `payroll.review` |
| P17 | `POST .../send-to-accountant` | `payroll.review` |
| P18, P19 | `POST .../send-back`, `.../approve` | `payroll.approve` |
| P20 | `POST .../sites/:siteId/remind` | `payroll.remind` |
| P21 | `POST .../sites/:siteId/approve-late` | `payroll.approve_site_late` |

## Who does what

| Role | Reads | Review work | Approves | Remind a site | Late approval |
|---|---|---|---|---|---|
| HR Manager | yes | yes (and sends) | no | yes | no |
| Accountant | yes, and the estimate | no | yes (PIN, not the preparer) | yes | no |
| Director | yes, and the estimate | no | no | yes | yes (more than 5 days after month end) |
| System Admin | yes, and the estimate | no | no | no | no |
| Branch and Store Managers, staff | no | no | no | no | no |

## Doors and hooks

- `registerPayroll()` (in `routes/index.ts`) registers the attendance switch-off check: a branch's clock cannot be switched off while its payroll month is unpaid.
- `src/services/payslip-service.ts` asks `rollout-guard` before any write for a covered site and month; it fails closed.
- 1A's `timesheets/approval/approve-service.ts` takes `options.lateForSiteId` so the Director's late approval reuses it.

## Tests

Unit tests beside every sub-folder; `payroll-routes.test.ts` (the role matrix, 66 cases); `payroll-flow-db.test.ts` (9 flows against the database; export `DATABASE_URL` and run it alone); `src/scripts/payroll-proof.ts` (real logins, 132 checks). The time-zone script `pnpm test:workforce-tz` covers the pure folders in UTC, Nairobi and Los Angeles.

## Not built (part 2 and the front end)

Publish, the bank file, Mark as paid, corrections (payslip version 2), the exports, the `PS-` payslip numbers, staff payslip reads, notifications. The migration's `payroll_months_approved_has_signature` check and `unpaidMonthKeys` need extending when `PUBLISHED` and `PAID` arrive.
