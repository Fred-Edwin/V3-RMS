# Workforce · People (slice 1a: Hire and the file)

**Status:** slice 1a (hire and the file) back end built 17 Oct 2026 on branch `feat/workforce-1a-employees`; slice 1b (departments, positions, heads, the Organisation endpoints, the head claims) back end built 17 Oct 2026 on branch `feat/workforce-1b-heads`, cut from 1a. Neither is merged or pushed. No screens yet: the front end is a separate, later session. Every 1b decision is in [decisions-1b-backend.md](../../../../docs/features/workforce/decisions-1b-backend.md).

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
| W10 | `POST /workforce/people/:id/pay-changes` | `payprofile.write`. Never for your own file (403). A Director's request is decided at once (APPROVED, applied if the day has come; HR and the Accountant are told, no amount); an HR or System Admin request waits for a different Director. |
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

## Organisation endpoints (slice 1b: all `authenticate`, `attachWorkforceSubject`, `requireCapability`)

| # | Route | Capability | Notes |
|---|---|---|---|
| O1 | `GET /workforce/org` (`?includeRetired`) | `org.read` | Sites, their departments, heads, gaps and four counts. Scope trims what is listed. |
| O2 | `GET /workforce/org/departments/:id` (`?page&perPage`) | `org.read` | Head, acting head, a page of people, the casual pool (rates only with pay read). `can` says what the caller may do. |
| O3 | `POST /workforce/org/departments` | `org.write` | `{ siteId, name, description?, positionIds[] }`. 409 `DEPARTMENT_NAME_TAKEN`. |
| O4 | `PATCH /workforce/org/departments/:id` | `org.write` | Name, description, offered positions. |
| O5 | `POST .../departments/:id/retire`, `.../restore` | `org.write` | 409 `DEPARTMENT_HAS_PEOPLE`; the five standard departments: 409 `DEPARTMENT_MANAGED_BY_INVENTORY`. |
| O6 | `GET .../departments/:id/head-candidates` | `org.write_heads` | Eligible people, longest tenure first; one `recommended`. |
| O6b | `GET .../departments/:id/head-candidates/no-login` | `org.write_heads` | Monthly staff of the department with no login yet (`employeeId`, `name`, `positionName`). |
| O7 | `POST .../departments/:id/head/preview` | `org.write_heads` | What changes: rows ended, claims before and after, impacts from later slices, who is told. Writes nothing. |
| O8 | `POST .../departments/:id/head` | `org.write_heads` | `{ employeeId, mode: REPLACE \| ACTING, returnsOn?, replaceActing?, reason? }`. 409 `HEAD_NOT_ELIGIBLE`, `ALREADY_HEAD`, `ACTING_HEAD_EXISTS`, `HUB_HAS_NO_HEADS`, `INVALID_RETURN_DATE` (400). |
| O9 | `POST .../departments/:id/head/end` | `org.write_heads` | `{ which: HEAD \| ACTING, reason }`. 409 `NO_HEAD_TO_END`. |
| O10 to O11 | `GET /workforce/org/positions` (`?departmentId&includeRetired&q`), `.../positions/:id` | `org.read` | Holder names only for those the viewer may see. |
| O12 | `POST /workforce/org/positions` | `org.write` | Company-wide write (HR, Director, System Admin). |
| O13 | `GET .../positions/:id/impact?defaultTracksTime=` | `org.write` | People who would switch, and machine-readable impacts. |
| O14 | `PATCH .../positions/:id` | `org.write` | Changing "clocks in" needs `acknowledgedPeople` = the impact count (409 `ACKNOWLEDGE_IMPACT`). |
| O15 | `POST .../positions/:id/retire`, `.../restore` | `org.write` | 409 `POSITION_HELD` lists holders. |

Out of scope reads (O1, O2, O11) answer `404`; a role with no organisation capability answers `403`; out of scope writes `403`.

**Who sees what in the organisation:** HR, the Director and the System Admin read and write everything (the Director and System Admin since 21 Oct 2026); a Branch Manager or Store Manager reads their own site and may name or end heads there (not add departments or positions); a department head reads their own departments only; the Accountant and staff have no access. The Central Store never has heads.

**The head claims (one place).** `User.isDepartmentHead` and `departmentTag` are written only through `accountGateway.setHeadClaims` (`organisation/heads/head-sync.ts` calls it), inside the transaction of every flow that changes a head row: assign, replace, acting, end, exit, transfer, undo exit and the nightly `reconcileHeadClaims`. The claim is true only for a head of a department with an inventory tag. `department.head_changed` is emitted after commit with the previous and new head. `workforce-layering.test.ts` fails if any other file writes the claim.

## Who sees what

| Viewer | Pay, bank, ids, documents | Hire | Exit, transfer, rehire |
|---|---|---|---|
| HR Manager | all | yes | yes |
| Director | all (and payslip opens) | yes | yes (never their own file) |
| Accountant | all | no | no |
| Branch Manager / Store Manager (own site) | locked | basics, onboarding files only | no |
| Department head (the departments they head) | locked | no | no |
| System Admin | all (and payslip opens) | yes | yes |
| The person themself | all, in clear | no | no |

## Scheduler (`scheduler/people-scheduler.ts`, job `people.scheduler`, 00:05 Nairobi)

`activateStarted`, `finalizeExits`, `applyMoves` (due transfers, loans starting and ending), `applyPayChanges`, `reconcileHeadClaims` (slice 1b: recomputes the head claims of everyone with a claim or an open head row; one `org.head_claims_reconciled` entry per company when something changed), `expireDrafts`. Each claims its rows with a guarded update, so a second run on the same day changes nothing. Entries it writes have channel `SYSTEM`.

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
  organisation/                 slice 1b: org-controller, org-scope (access checks), org-validators, org.types
    departments/                repository, read service (O1, O2), write service (O3 to O5), view builders
    heads/                      repository, plan + eligibility rules, assign/end service, head-sync (the claims),
                                head-undo, reconcile-head-claims (scheduler task)
    positions/                  repository and service (O10 to O15)
  org-routes.ts                 the Organisation router (mounted since 1a)
```

**Files of 1a touched by 1b (all small):** `people-account-gateway.ts` (`setHeadClaims` implemented), `lifecycle/lifecycle-engine.ts`, `lifecycle/exit-service.ts` and `lifecycle/lifecycle-repository.ts` (head ending, claims and events moved to `organisation/heads`; the old `activeHeadRows`, `endHeads`, `restoreHead`, `departmentHasHead` and `headEndDate` are gone), `scheduler/people-scheduler.ts` (sixth task), `org-routes.ts`, `people-flow-db.test.ts` (six scheduler tasks), `workforce-layering.test.ts`, `_shared/audit/audit-actions.ts`, `workforce/index.ts` (a comment), `routes/index.ts` (a comment).

**Size check (17 Oct 2026):** new 1b source files are at most 190 lines (`positions-service.ts`) and the new folders hold at most 10 files (`organisation/`, `heads/` 9). Left from before 1b and not touched: `people/` holds 23 files, `employees/employees-service.ts` is 371 lines, `employees-repository.ts` 342, `_shared/time` 15 files, `rules` 13 files.

**Overlap with the legacy department endpoints** (`routes/department-routes.ts`, `services/department-service.ts`, `repositories/department-repository.ts`) is left running: they also write the two head claims by hand. Until the Organisation screen replaces the old department page, the two writers can disagree; the nightly reconcile corrects the claim from the head rows (it does not read the legacy flags). The old `/staff-transfers` code still clears a head marker on a login move.

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
3. **Exit and transfer end a person's head rows.** In 1a this did not write the `User` claims or emit `department.head_changed`; **slice 1b now does both in the same transaction** (see "The head claims" above). The head row is ended the day before; a row that started today is removed. Undo restores the head role only if the department has no head.
4. **Six scheduler tasks** (`reconcileHeadClaims` arrived with 1b). An extra audit action, `people.activated`, records onboarding becoming active (one entry per company per run, never per person).
5. **A loan starting by the scheduler writes no audit entry of its own**; the creation entry already records its start date. A loan ending writes `people.loan_ended`.
6. **Pay set at hire** creates an `APPROVED` `HIRING` pay change dated the start day, and the profile shows the amount at once. `payAmountOn` therefore returns nothing before the start date.
7. **File-request and "told" notifications** only log (the Notifier is a later slice).
8. **The exit checklist** (`uniformReturned`) is audited as `people.updated` (no dedicated action).
9. **Transfer** sets the new reports-to from the request, else the new department's head, else none.
10. **Rate limit note for tests:** the login endpoint allows 10 per minute; scripts that sign in as many roles must wait.
11. **Wire names:** the API says `organization`, the code says `site`; docs use the wire names.

### Owner decisions on the open questions (17 Oct 2026)

- **Head status on exit or transfer (decision 3 above): accepted.** Until slice 1b, only the head rows end; the `User` flags are not written. Slice 1b writes all head changes in one place.
- **Pay start: accepted.** Pay does not count before the start day (`payAmountOn` returns nothing earlier). The front end should label a not-yet-started amount "starts <date>" so the profile is not misleading.
- **Pay 403 versus 404: accepted as built.** Out-of-scope reads answer `404` so a record's existence is not revealed; a role with no pay capability at all answers `403`.

### People batch 2B (22 Oct 2026, final pass)

- **New capability `payprofile.write_bank`** (Accountant, HR, Director, System Admin) in `_shared/workforce-access.ts`: the Accountant's Edit on IDs and bank is bank and account only; `pay-service.updateProfile` refuses overtime and hours for a holder of it alone.
- **My file saves at once.** `employees-service.patchMe` no longer clears HR's check (`statutoryVerifiedAt`) and no longer refuses a number HR has checked. HR's own edit (`update`) still clears it. A bank or account change (a first entry counts) tells the Accountant through `pay.bank_changed`, whose text carries no number.
- **My team:** `GET /workforce/people/team` in `team/` (capability `today.read`, the rota's scope; status from today's rota shift). Name, position, department, status, shift. No pay, no IDs.
- **Probation report:** verdicts `GOOD`, `NEEDS_WORK`, `NOT_GOOD` (`CONCERNS` stays readable); a head writes for their own department's people only.
- **File view:** `reportsTo` carries `positionName` and `siteName` (the wire says `organizationName`); `PayChangeRow` carries `requestedByPosition` and `requestedBySite`.
- Not changed: `DATA_MODEL.md` (no schema change). The `people/` folder was not split in this batch (27 files).

### People batch 3 (23 Oct 2026, the live-walk fixes)

- **One rule each.** `ACTIVE_STATUSES` (`people.constants.ts`: active, on leave, on notice, suspended) is "active" everywhere. "No head" is a branch department with people and no head or acting head today (an acting head counts as covered); Home, Organisation and Employees all read it. "Kinds" does not count the Overdue row.
- **Employees list.** Filters `on_probation`, `pay_change`, `pay_change_month` (`employees-pay-filter.ts`; the pay ones need `payprofile.read`); summary gains `payChangesWaiting` and `payChangesMonth` (`null` without pay access); rows gain `reportsToNobody` (a Branch Manager is never "Job details missing").
- **File view** gains `correctUntil` (the hiring manager's 24-hour correction window). **My team** rows gain `canReport`.
- Not changed: `DATA_MODEL.md` (no schema change). The audit `GET viewers` route is removed.

### Slice 0 changes made here (also logged in `slice-0-contract.md` §12)

`Employee` gains `companyId` (numbers unique per company); `PayProfile.amount` optional plus standard hours; `PayoutMethod` gains `CASH`; `Position` gains `loginRole`, `casualsAllowed` and `DepartmentPosition`; `DepartmentHead` gains `isActing`, `endedById`, `endReason`; `Contract` gains `createdById` and a `ContractType` link; new tables `PayChange`, `EmploymentSpell`, `EmployeeMove`, `FileRequest`, `EmployeeDraft`, `ProbationNote`; `Employee` gains probation and statutory fields; `HrDocument.employeeId`.
