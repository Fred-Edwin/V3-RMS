# Workforce roadmap: the six segments and what is left

**Updated:** 20 Oct 2026. This is the one place that lists the whole plan. Status of each piece is also in `docs/PROJECT_STATUS.md` and the slice table in [README.md](README.md). The method is `docs/FEATURE_REDO_PLAYBOOK.md`; briefs come from `docs/process/templates/`.

## The chain the feature builds
The **rota** is the promise, **clock events** are the fact, the **timesheet** is the approved truth, then **payroll** and the **payslip**. Around it: people, rules, leave, conduct, and shared parts (audit, "Needs you", errors, signed documents). All 17 Paper chapters were approved by the owner by 19 Oct 2026.

## Foundation, already built (slices 0 to 4a, before the segments)
| Slice | What | State |
|---|---|---|
| 0 Foundation | Access table, time engine, audit writer, rules store | Merged to `main` (PR #86) |
| UI kit and frame | Shared screen parts, role Homes, menus, the card registry | Built and approved |
| 1a, 1b People | Hire, file, contracts, pay profile, exit; departments and heads | Built and approved |
| 2 Rota | Weekly grid, templates, warnings, print; no publish step | Built and approved |
| 3 Attendance | Phone clock, undo, prompts, Today board, fixing time, per-site switch | Built and approved |
| 4a Timesheets | Replaced by Segment 1 | Superseded |

## The six segments
Each segment runs: segment review, spec session, back-end session (one or two), front-end session, one merge, the owner walks it and approves.

| # | Segment | What it delivers | Back end | Front end | Owner approval |
|---|---|---|---|---|---|
| 1 | **Timesheets rework and Rules** | The month approved by the site manager (no auto-close, no reopen), overtime all, part or none, PDF and Excel exports; the ten-tab Rules page with PIN changes, padlocks, history | Built | Built | **Approved** (Timesheets and Rules, browser walk, 19 to 20 Oct) |
| 2 | **Payroll** (desktop) | The month page with six tabs, calculation from the Accountant's tables, HR review, the Accountant's approval with PIN, publish, bank file, Mark as paid and the lock, corrections until Paid, exports, the Director's estimate, the rollout guard so nobody is paid twice | Built (parts 1 and 2) | Built | **Approved** (browser walk, 20 Oct) |
| 3 | **Payslips and casual pay** (phone, documents) | The server-enforced payslip code, hidden amounts, the A4 payslip, history and the P9, casual daily pay (head records, manager approves with PIN, receipts, the pay sheet) | Built | Built | **Approved** (browser walk, 20 Oct) |
| 4 | **Leave** | Leave home with a bar per type, request, history, a progress stepper per request, one decision screen with the rota, balances, minimum cover | Not started | Not started | n/a |
| 5 | **Conduct** | Warning notices from fixed letters, signing, appeals decided by HR, the staff Conduct page with downloads | Not started | Not started | n/a |
| 6 | **Shared parts** | One audit log with an Area filter, security alerts to the System Admin, the "Needs you" badges and Home cards (replacing Waiting for you), the error messages, signed documents with the QR verify page, the Director's payslip-opens digest | Not started | Not started | n/a |

Segments 4, 5 and 6 each need a spec session, one back-end session and one front-end session. Their specs can run at the same time in different lanes. Segment 6 is the largest.

## Branch map (all pushed as backups; only slice 0 is on `main`)
The top of the stack is `feat/workforce-segment-4` (it contains Segments 1 to 3). Earlier: `feat/workforce-segment-1`, `-2`, `-3`. Individual branches: `feat/workforce-ui-kit`, `-frame`, `-1a-employees`, `-1a-frontend`, `-1b-heads`, `-1b-frontend`, `-2-rota`, `-2-rota-frontend`, `-3-attendance`, `-3-attendance-frontend`, `-4a-timesheets`, `-4a-timesheets-frontend`, `-1a-timesheets-backend`, `-1a-timesheets-frontend`, `-1b-rules-backend`, `-1b-rules-frontend`, `-2a-payroll-backend`, `-2b-payroll-backend`, `-2-payroll-frontend`, `-3-payslips-backend`, `-3-payslips-frontend`. Separate: `fix/legacy-lateness-nairobi-time`. New lane branches are cut from the top of the stack.

## Outside the segments (the open list)
1. **Rules dialogs check** (parked by the owner): open the leave-type, minimum cover, Holidays and Casual work dialogs in a browser and save a Statutory table; none was opened in the Rules front-end session.
2. **Tidy-up and ship preparation** (parked until the segments are built; brief `docs/sessions/workforce-ship-prep.md`): split the old files over 350 lines and the folders over 12 files (`employees-service.ts` 371 lines; `people/`, `_shared/time`, `rules` folders), fix the failing lane database test and the stale proof script, add an **automatic size and folder-limit test** (it passes on day one), and write the **ship checklist**: migrations in order, a rehearsal on a restored production copy run by the owner, the pull request plan, the **Nyeri Town switch-on** (System Admin only, at `/app/workforce/attendance/switch`) with rollback, and **the Accountant hand-checking the first payroll month against a calculation by hand**. Also check the Dockerfile copies the PDF fonts and logo.
3. **Small gaps logged:** Timesheets "Excuse" button; the in-app Document view for the timesheet PDF; Payroll "Call HR" line source; the named petty-cash holder in Rules (needs login ids in the people list); a screen for a department head's overtime note; the Rules approved-month guard must read the real month approval (now that Timesheets approval exists); the QR on documents leads nowhere until Segment 6's verify page; the P9 layout needs the Accountant's one-time confirmation before first use.
4. **Legacy lateness fix** (`fix/legacy-lateness-nairobi-time`): accepted, not pushed as a PR; tell Branch Managers the old HR attendance figures will change. Other server-local date code in legacy files (for example `staff-repository.ts getTodayRange`) is logged, not fixed.
5. **Rota change notices** are batched in memory (a restart can lose a waiting notice); Redis jobs (attendance auto-close, timesheets sweep, escalation, the payroll estimate refresh) need the worker running in production.
6. **Demo video** for the client (planned separately): a happy-path browser walkthrough with designed captions, recorded with Playwright from a demo lane.
7. **Digital Orders refactor** (pinned): planned after Workforce with `docs/process/templates/orchestrator-start.md`.

## Ship order
Segments 4 to 6 built and approved, then the tidy-up and checklist session, the rehearsal on a production copy, one pull request for the whole stack, deploy, switch on Nyeri Town for Attendance and Payroll, and the owner watches real use. The Progress Hub README conflict with `main`'s README is expected at merge.

## Decisions in force
The owner's decisions are in the design-pass notes (`design-pass-1-leave-conduct.md`, `design-pass-3-payroll.md`, `design-pass-4-shared-parts.md`), the spec decision logs (`specs/decisions-*.md`) and the session decision logs (`decisions-*.md`). Key ones: Paper is a demonstration and production is the goal; a timesheet period is the calendar month; each site's manager approves their own timesheets, HR cannot; the attendance switch is System Admin only; Nyeri Town is the pilot; payment is bank only; Paid locks the month; a department head approves nothing; Waiting for you is replaced by "Needs you" badges and cards; the System Admin receives security alerts; one audit log with an Area filter; nobody is ever locked out for wrong codes.
