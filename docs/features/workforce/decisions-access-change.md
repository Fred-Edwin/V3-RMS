# Workforce final pass: the access change (Director and System Admin), decisions

Owner decision, 21 Oct 2026 (current and final): the Director and the System Admin read and write everything in Workforce. It reverses D2 and D15 (the System Admin had no pay, IDs or bank) and the "Director reads, HR writes" split. Built on branch `feat/workforce-access-change` in the lane 2 worktree. Brief: `docs/sessions/final-pass-access-change.md`.

| # | Choice | Why | What I kept |
|---|---|---|---|
| 1 | One computed set, `FULL_ACCESS` (every capability at scope `all`) minus `NOT_FULL`, replaces the two hand-written role blocks in `_shared/workforce-access.ts`. | A new capability reaches both roles unless someone excludes it on purpose; the file got 57 lines shorter (it was already over 350). | The matrix test still lists every cell by hand, so a change shows up as a red test. |
| 2 | Own-file capabilities (`me.file`, `me.payslip`, `me.payprofile`, `time.own`, `leave.request`, `discipline.read_own`, `audit.read_own`) stay as they were: the Director keeps them at `own`, the System Admin has none. | The System Admin still has no file, payslip or clock of its own (only the Show buttons on other people's records widen). | `notifications.own` and `security.phones.own` stay at `own` for both. |
| 3 | The locked groups are gone for both roles (`lockedGroupsFor` returns nothing for them): pay, bank, IDs, documents, conduct file, payslip opens. | They now hold `payprofile.read`, `employee.read_sensitive`, `discipline.read` and `audit.read.payslip_access`. | The audited Show buttons stay; every reveal still writes its entry. |
| 4 | **Nobody changes, decides, signs or exits themself.** `assertNotSelf` is now applied to a pay change request, a pay/bank profile edit, every lifecycle write (exit, rehire, transfer, loan, probation decision; in `loadForWrite`) and a job-details edit. | The Director could previously not write at all, so these paths never needed the check. Leave, conduct, days, overtime, casual and payroll approval already refused the subject (their tests still pass). | HR's own file is covered by the same rule, which is the intent ("nobody"). The person still edits their own contact details through the self-service route. |
| 5 | **Second pair of eyes.** A Director's pay change is created and decided in one transaction: status APPROVED, applied at once if its day has come, two audit entries (asked, decided), no Director approval step. HR and the Accountant are told with `pay.changed_by_director` (no amount; wording added). | Owner rule. | An HR request, and a System Admin request, still waits for a Director other than the requester; `decide` already refuses the requester and the subject (403 `SELF_APPROVAL`). The System Admin holds both `payprofile.write` and `payprofile.approve`; it cannot approve its own request. |
| 6 | PIN steps are unchanged: the actor's own PIN, checked by `verifySignerPin` before anything is written (pay change, pay decision, Rules draft and withdraw, warnings, appeals, month approval). | Nothing in the change touches it. | The proof used each actor's own PIN; there is no code path where a PIN is skipped for a role. |
| 7 | Accountant steps stay with the Accountant: `payroll.approve`, `payroll.pay`, `p9.confirm_format`, `rules.confirm.pay_rates`, `rules.confirm.statutory`. | Brief: do not take over the Accountant's approval steps. | When the Director or System Admin edits statutory tables or the holiday pay rate, the Accountant still confirms it, so the Accountant is the second pair of eyes there. |
| 8 | HR's payroll preparation stays with HR: `payroll.review`, `payroll.publish`, `payroll.correct`, `p9.generate`. | Not Accountant steps, but "if unsure, keep the step with the role that has it today". Both new roles read all of payroll, export it, remind a site and (Director and System Admin) approve a site's month late (`payroll.approve_site_late`). | Say if you want them to prepare and publish as well; it is one line in `NOT_FULL`. |
| 9 | `payslip.read_any` (open anyone's payslip from Payroll) stays with HR and the Accountant. | That path audits "opened by" and tells the Director; letting the Director open payslips would notify itself. The payslip *figures* on the pay setup and payroll pages are visible to both roles. | The daily openings list (`audit.read.payslip_access`) is now readable by the System Admin too. |
| 10 | `discipline.decide` stays with the Director (and HR); the System Admin does not get it. | The service already narrows it by role (the Director decides notices HR issued, HR the others); a System Admin holding it would see a Decide button that always answers `NOT_DECIDER`. | The System Admin can read and issue conduct notices (`discipline.read`, `discipline.issue`) and holds every audit read. |
| 11 | `timesheet.close` (approve the month, with a PIN) stays the site's own manager's, and the Director's at `unit` (their own site). The System Admin does not close a month. | "The site's own manager only" (Segment 1A amendment, D7). | `timesheet.approve`, `overtime.approve`, `time_request.answer`, `manager_time.decide` and exports are at `all` for both. |
| 12 | `attendance.switch`, `security.alerts.read`, `security.alerts.clear` and `needs_you.remind` are now held by both roles. | "Every Workforce capability" for both. Earlier text gave the switch and alerts to the System Admin only. | The screens are unchanged; the menu follows the nav table, so the Director gets no new link (Batch 2 redesigns the menu). |
| 13 | Branch Manager and Store Manager reach neither role. | `hiddenFromUnitManager` is unchanged and a Director or System Admin file sits at the head office or the Central Store. | New tests: a Store Manager is out of scope for both; the HTTP proof shows 403/404 on read, pay change, exit, edit and a Rules draft. |
| 14 | Every write is audited with the actor's name through the existing audit door; entries carry no pay figure, PIN or ID number. | Unchanged door. | A test reads the PAY_SETUP entries of a changed person and finds none of the amounts. |

## Rights before and after

| Capability group | Director before | Director after | System Admin before | System Admin after |
|---|---|---|---|---|
| Rota edits, today (clock for someone, absent), time fixes | read only | all | all | all |
| Attendance switch, security alerts | no | all | switch and alerts | all |
| Timesheets: days, overtime, requests, manager days, exports | manager days only | all | read, requests, fixes | all |
| Casual sheets: record, approve, read | approve, read | all | none | all |
| Leave: read, approve, acknowledge, balance adjust | read, approve | all | read, approve | all |
| People: IDs, bank, documents | read | read, write | none | read, write |
| People: hire, edit, exit, rehire, transfer | none | all (never their own file) | edit basics, lifecycle | all (never their own file) |
| Pay: read | read | read, write | none | read, write |
| Pay change: request / decide | decide | both; their own request applies at once | none | both; cannot decide their own request |
| Departments, positions, heads | read | write | write | write |
| Rules edits | all but leave types, statutory and the holiday pay rate | every rule | minimum cover only | every rule |
| Rules confirm | holiday list | holiday list (Accountant keeps pay rates and statutory) | none | holiday list |
| Payroll: read, export, estimate, remind, late site approval | read, export, remind, estimate, late approval | same | read, estimate | same |
| Payroll: review, approve, publish, pay, correct, P9, open any payslip | none | none | none | none |
| Conduct: read, issue, decide | read, decide | read, issue, decide | none | read, issue |
| Audit reads | all | all | security and rules | all |
