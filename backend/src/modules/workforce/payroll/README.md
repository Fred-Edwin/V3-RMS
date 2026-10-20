# Workforce · Payroll (Segment 2A, part 1)

**Status:** back end built 20 Oct 2026 (not pushed, awaiting the owner's review): part 1 on `feat/workforce-2a-payroll-backend` (the month, the engine, the review and the approval), part 2 on `feat/workforce-2b-payroll-backend` (publish, corrections, the bank file, Mark as paid and the lock, exports, payslip numbers; see the section "Part 2" below). Spec: `docs/features/workforce/design-pass-3-payroll.md`. Decisions: `docs/features/workforce/decisions-2a-payroll-backend.md`. HTTP proof: `docs/features/workforce/payroll-2a-http-proof-output.txt`.

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

## Part 2 (Segment 2B, 20 Oct 2026, `feat/workforce-2b-payroll-backend`, not pushed)

Publish, corrections until Paid, the bank file, Mark as paid and the lock, and the documents. Decisions: `docs/features/workforce/decisions-2b-payroll-backend.md`. Proofs: `payroll-part2-db.test.ts` (9 database flows), `src/scripts/payroll-proof-2.ts` (162 checks with real logins, continuing `payroll-proof.ts`).

| Folder | What lives there |
|---|---|
| `publish/` | HR publishes with a PIN: one transaction numbers every payslip `PS-nnnn` (sequence, in `payroll_publications`), the month becomes `PUBLISHED`; staff are told after the commit. |
| `corrections/` | Inputs, live preview, save. A correction is payslip version n+1 (insert-only; version n stays readable and is reported as replaced), a snapshot revision r+1, a void of the bank file when a bank-paid net changed. Pure: `apply-correction.ts`, `correction-diff.ts`, `snapshot-revision.ts`. |
| `bank/` | The pay-out card, the bank file (`BankFileFormat`, Generic CSV), the voiding rules. The file is rebuilt, never stored; its hash is what Mark as paid checks. |
| `paid/` | Mark as paid with a PIN and the current file's hash; sets `PAID` and `locked_at`. |
| `exports/` | Register PDF and Excel, summary PDF, statutory schedules, all payslips (zip). `render/` holds the drawers; the model is read from the latest snapshot (a draft from the current run). |

### The lock

From `locked_at` every payroll write answers `409 MONTH_LOCKED` in the service (`assertNotLocked`, also inside `assertState`), and a database trigger (`payroll_locked_month_guard`) refuses the same writes on every payroll table, so a bug cannot get round it. Allowed after Paid: reads, exports, "download the bank file again" (audited, no row), and switching the branch's clock off (`unpaidMonthKeys` now ignores `PAID`). `ALREADY_PAID` answers a second Mark as paid.

### Endpoints added (`docs/API_CONTRACT.md` §40)

| # | Route | Capability |
|---|---|---|
| P22 | `POST .../publish` | `payroll.publish` |
| P23 to P25 | `GET .../payslips/:id/correction-inputs?version=`, `POST .../correction-preview`, `POST .../correct` | `payroll.correct` |
| P26 | `GET .../payout` | `payroll.read` |
| P27 | `POST .../bank-file` (streams the CSV) | `payroll.pay` |
| P28 | `POST .../mark-paid` | `payroll.pay` |
| P29 | `POST .../exports` (`kind` REGISTER, SUMMARY, STATUTORY, PAYSLIPS; `format` pdf, xlsx, zip) | `payroll.export` |

### Hand-over to Segment 3

Published payslips are `payroll_payslips` rows (current version = highest `version` per person and run; `replaces_version`, `reason` on a correction), their lines with `working_text`, the number in `payroll_publications`, the frozen document in `payroll_snapshots` (latest revision; each payslip carries `ids`, `payoutMethod`, `version`, lines with `base`, `rate`). Events `payroll.month_published`, `payroll.payslip_corrected` (with `userId`, `payslipNumber`, `version`) and `payroll.month_paid`; notification keys `payroll.payslip_published`, `payroll.payslip_corrected`, `payroll.month_paid`. Segment 3 builds the staff endpoints, the audited open of someone else's payslip and the P9.

## Not built

The staff payslip phone endpoints, casual pay, the P9 (Segment 3), the background export job (decision X3), a per-company bank format setting (X14), and any front end.
