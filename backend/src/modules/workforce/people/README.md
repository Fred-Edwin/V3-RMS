# Workforce · People (slice 1a: Hire and the file)

**Status:** back end built (17 Oct 2026), on branch `feat/workforce-1a-employees`, not merged. No screens yet: the front end is a separate, later session. Slice 1b (departments, positions, assigning heads, the Organisation endpoints) is not built; its router (`org-routes.ts`) is mounted and empty.

People is the employee file: who works here, their job, pay, contract, probation, moves, exit and rehire. It replaces the old HR profile and Staff screens one piece at a time. The old contract draft (`feat/workforce-people`, `slice-1-contract.md`) was reference only; this README records what was actually built and where it differs.

## What it does

- **Hire** (`POST /workforce/people`): a Branch Manager or Store Manager files the basics; HR may add pay, statutory and bank details and a login in the same call. Pay set at hire is in force at once (only later changes go to the Director). A casual has no login, bank step or contract. An existing account (Director, HR, Accountant, an old Staff account) is *adopted* into a file with `existingUserId`.
- **The file** (`GET /workforce/people/:id`): everything about a person, with sensitive fields hidden by omission (`locked` lists the groups) and ID and bank numbers masked (`•••• 5678`). The clear value only comes from the audited `reveal` call.
- **Edit job** (`PATCH`): a manager edits a file only while it is `ONBOARDING`; afterwards HR. A field the caller may not change is refused (`403 FIELD_NOT_ALLOWED`), never ignored.
- **Pay**: HR changes payout details and hours; HR *requests* a pay change; the **Director** approves or declines it (`SELF_APPROVAL` is refused). An approved change takes effect on its start day (now, or by the scheduler). `payAmountOn(employeeId, date)` is exported for payroll.
- **Contract and probation**: recording a contract completes a probation confirmation that was waiting for it. Extension is limited by the Probation rules. Heads, Branch Managers and HR add probation notes.
- **Transfer, send to another site (loan)**: dated; a transfer moves the login through the legacy transfer code; a loan ends by itself.
- **Exit, undo, finalise, rehire**: an exit is a notice until its last day passes; the scheduler then closes the file (contracts ended, head roles ended, scheduled moves cancelled, login stopped). Undo works for 7 days after the last day. Rehire reopens the *same* file after that.
- **Login creation**, **file requests** ("ask Joy for her emergency contact"), **statutory verification**, **documents**, **the employee's own file and photo**.

## Endpoints (all `authenticate`, then `attachWorkforceSubject`, then `requireCapability`; never `requireRole`)

Wire names say `organization` (the API's `wire-names` layer): a response has `organizationId` and `organizations` where the code says `siteId` and `sites`.

| # | Route | Capability |
|---|---|---|
| R1 | `GET /workforce/people` (search, filter, page) | `employee.read_basic` |
| R2 | `GET /workforce/people/summary` | `employee.read_basic` |
| R3 | `GET /workforce/people/lookups` | `employee.read_basic` or `org.read` |
| R4 | `GET /workforce/people/duplicate-check` (booleans only) | `employee.write_basic` |
| R5 | `GET /workforce/people/unlinked-accounts` | `employee.lifecycle` |
| R6 | `GET /workforce/people/me` | `me.file` |
| R7 | `GET /workforce/people/:id` | `employee.read_basic` or `me.file` |
| R8 | `GET /workforce/people/:id/pay` (audited unless own) | `payprofile.read` or `me.payprofile` |
| R9 | `GET /workforce/people/:id/documents` | `employee.read_sensitive` or `me.file` |
| R10 | `GET /workforce/people/:id/documents/:docId` (audited unless own) | same |
| R11 | `GET /workforce/people/pay-changes` | `payprofile.approve` or `payprofile.write` |
| W1–W4 | drafts: list, create, update, delete | `employee.write_basic` |
| W5 | `POST /workforce/people` (hire) | `employee.write_basic` |
| W6 | `PATCH /workforce/people/:id` | `employee.write_basic` or `employee.write_sensitive` |
| W7 | `PATCH /workforce/people/me` | `me.file` |
| W8 | `POST /workforce/people/:id/photo`, `/me/photo` | `employee.write_basic` or `me.file` |
| W9 | `PUT /workforce/people/:id/pay-profile` | `payprofile.write` |
| W10 | `POST /workforce/people/:id/pay-changes` | `payprofile.write` |
| W11 | `POST /workforce/people/pay-changes/:changeId/decision` | `payprofile.approve` |
| W12 | `POST /workforce/people/:id/contract` | `employee.write_sensitive` |
| W13 | `POST /workforce/people/:id/probation-decision` | `employee.lifecycle` |
| W14 | `POST /workforce/people/:id/probation-notes` | `probation.note` |
| W15–W16 | `POST .../transfer/preview`, `.../transfer` | `employee.lifecycle` |
| W17 | `POST .../loan` | `employee.lifecycle` |
| W18 | `POST .../moves/:moveId/cancel`, `.../end` | `employee.lifecycle` |
| W19–W22 | `POST .../exit/preview`, `.../exit`, `PATCH .../exit/checklist`, `POST .../exit/undo` | `employee.lifecycle` |
| W23 | `POST .../rehire` | `employee.lifecycle` |
| W24 | `POST .../login` | `employee.lifecycle` |
| W25 | `POST .../file-requests`, `.../file-requests/:requestId/remind` | `employee.write_basic` |
| W26 | `POST .../verify-statutory` | `employee.write_sensitive` |
| W27 | `POST .../documents` (multipart) | `employee.write_sensitive` or `me.file` |
| W28 | `POST .../reveal` (audited unless own) | `employee.read_sensitive` or `me.file` |

Out of scope reads answer `404`; out of scope writes `403`. A Branch Manager asking for another person's pay gets `404`; a role with no pay capability at all gets `403`.

## Who sees what

| Viewer | Pay, bank, ids, documents | Hire | Exit, transfer, rehire |
|---|---|---|---|
| HR Manager | all | yes | yes |
| Director | all (and payslip opens) | no | no |
| Accountant | all | no | no |
| Branch Manager / Store Manager (own site) | locked | basics, onboarding files only | no |
| Department head (the departments they head) | locked | no | no |
| System Admin | locked | basics | yes |
| The person themself | all, in clear | no | no |

## Scheduler (`scheduler/people-scheduler.ts`, job `people.scheduler`, 00:05 Nairobi)

`activateStarted`, `finalizeExits`, `applyMoves` (due transfers, loans starting and ending), `applyPayChanges`, `expireDrafts`. Each claims its rows with a guarded update, so a second run on the same day changes nothing. Entries it writes have channel `SYSTEM`. `reconcileHeadClaims` belongs to slice 1b.

## Layout

```
people/
  people-*.ts, people.*.ts      shared: constants, types, validators, dates, completeness, masking, access helpers,
                                context (actor, today, "told"), subject, hooks, account gateway, door, routes, controller
  employees/                    repository, service (reads, edits), file-view builder, sensitive opens (reveal, documents)
  hire/                         hire service and repository, drafts
  pay/                          pay service and repository, pay maths (cents, no floats)
  lifecycle/                    probation + contract, moves (transfer, loan), exit (exit, undo, rehire), engine, sweeps
  scheduler/                    the daily tasks and their repository
```

Rules held by `workforce-layering.test.ts`: Prisma only in `*-repository.ts` (the audit writer's `$transaction` is the one named exception); only `people-account-gateway.ts` imports legacy `services/` or `repositories/`; no `requireRole(`; no `any`.

## Coupling

- **Access:** `access.prisma` gains `Site.employees` and `User.employee`; `workforce.prisma` gains `ContractType.contracts` and `HrDocument.employeeId`. The gateway is the only caller of legacy Access code. `hardDeleteStaff` refuses an account that has a file.
- **Inventory:** `Department` is Inventory's existing model (`departments`); People adds `description` and the relations `employees`, `heads`, `positions`. `User.isDepartmentHead` and `departmentTag` are untouched.
- **Later slices** register at start-up through `registerImpactProvider` so previews can say what a transfer or exit does to their data (rota shifts, approvals, final pay).
- **Events** (after commit): `employee.hired`, `.transferred`, `.loaned`, `.exit_recorded`, `.exit_finalized`, `.exit_undone`, `.rehired`, `.tracks_time_changed`, `pay.change_requested`, `pay.change_decided`. None carries an amount or an ID number.

## Backfill

Migration `20261017111315_workforce_people` creates the tables and backfills one employee per active human login (not the System Admin, display accounts, inactive or deleted users), with a pay profile, a spell, a contract where the legacy profile named a type, departments from role, and heads from today's flags. The backfill sits between `-- BEGIN PEOPLE BACKFILL` and `-- END PEOPLE BACKFILL` in the migration. Prove it on a copy of the lane database with `backend/scripts/proof/people-backfill-proof.sh [--fixtures]` (it refuses to touch a database not ending in `_proof`).

## Tests

Unit: dates (also in `test:workforce-tz`), completeness, head claims, validators, pay maths, the access matrix. Integration: `people-flow-db.test.ts` runs 13 flows against the lane database (only when `DATABASE_URL` names a `_lane` database) and removes the rows it makes; the audit entries stay (append-only).

## Decisions (every departure from the reference contract)

1. **`Department` is not a new table.** Inventory's `departments` (Block 1) is extended: `description` added, relations `employees`, `heads`, `positions`. The contract's `inventoryTag` and `isActive` are the existing `key` and `status`. The tag-uniqueness index is on `(organization_id, key)`. The backfill uses the departments Inventory already created and prefers a user's `department_id` over the role rule.
2. **Account creation by HR** uses the contract's fallback: after Workforce checks `employee.lifecycle`, the gateway calls `staffService.createStaff` as a system actor. Access has not changed `createStaff`.
3. **Exit and transfer end a person's head rows but do not write the `User` claims or emit `department.head_changed`.** That is slice 1b (with assigning heads and `reconcileHeadClaims`). The head row is ended the day before (never before it started). Undo restores the head role only if the department has no head.
4. **Five scheduler tasks, not six** (`reconcileHeadClaims` is 1b). An extra audit action, `people.activated`, records onboarding becoming active (one entry per company per run, never per person).
5. **A loan starting by the scheduler writes no audit entry of its own**; the creation entry already records its start date. A loan ending writes `people.loan_ended`.
6. **Pay set at hire** creates an `APPROVED` `HIRING` pay change dated the start day, and the profile shows the amount at once. `payAmountOn` therefore returns nothing before the start date.
7. **File-request and "told" notifications** only log (the Notifier is a later slice).
8. **The exit checklist** (`uniformReturned`) is audited as `people.updated` (no dedicated action).
9. **Transfer** sets the new reports-to from the request, else the new department's head, else none.
10. **Rate limit note for tests:** the login endpoint allows 10 per minute; scripts that sign in as many roles must wait.
11. **Wire names:** the API says `organization`, the code says `site`; docs use the wire names.

### Slice 0 changes made here (also logged in `slice-0-contract.md` §12)

`Employee` gains `companyId` (numbers unique per company); `PayProfile.amount` optional plus standard hours; `PayoutMethod` gains `CASH`; `Position` gains `loginRole`, `casualsAllowed` and `DepartmentPosition`; `DepartmentHead` gains `isActing`, `endedById`, `endReason`; `Contract` gains `createdById` and a `ContractType` link; new tables `PayChange`, `EmploymentSpell`, `EmployeeMove`, `FileRequest`, `EmployeeDraft`, `ProbationNote`; `Employee` gains probation and statutory fields; `HrDocument.employeeId`.
