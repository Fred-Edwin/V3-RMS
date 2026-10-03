# Workforce — audit and critique

Phase 2 of the design lane (`docs/sessions/design-lane-workforce.md`). Written 4 Oct 2026 from `main` at `9cd7309`, checked on lane 3 (own database, demo data seeded into the lane only; nothing touched on production).

**How this was checked.** Code was read (services, routes, schema, repositories, page sizes). Screens were walked in a real browser as the **Branch Manager (Town)**, **HR Manager** and **Waiter (phone-size)**. Statements marked *(code)* come from reading code, *(seen)* from using the screen, *(estimated)* from the navigation structure.

**Second pass (4 Oct, at the owner's request).** After Stop 1 I also walked: the waiter's leave request on a phone, the HR employee profile (Overview, Leave, Disciplinary, Documents, Transfers tabs), and the department head's scheduler (Kitchen head, Town). Findings are in §8. Still covered by code reading only: leave approval screens, Director and Accountant views, Barista/Chef phone views. The clock-in tap did not complete in my test (see §4), so clock-out and undo were checked in code, not on screen.

---

## 1. Scatter map

| Task | Backend (today) | Frontend pages (today) | Roles who reach it |
|---|---|---|---|
| Staff accounts (create, reset password, deactivate) | `staff-service`, `staff-routes` | `manage/staff` (651 lines) | Manager, Store Mgr, HR, Director, Admin |
| Employee record (profile, contract, statutory IDs, bank) | `hr-service` (922 lines), `hr-repository` | `hr/staff`, `hr/staff/[userId]` (825) | HR, Director, Admin; self for own details |
| Contract types and leave policy | `hr-service` | `hr/contract-types` | HR, Director, Admin |
| Leave (request, approve, revert, balance) | `hr-service` | `hr/leave`, `hr/my-leave`, `hr/leave/calendar` | all staff request; HR/Manager approve |
| Discipline | `hr-service` | inside `hr/staff/[userId]` | HR, Director, Admin, Manager |
| HR documents | `hr-service` | inside `hr/staff/[userId]` | HR roles |
| Transfers | `staff-transfer-service` (59 lines) | `hr/staff` (icon in row) | Director, HR, Admin |
| Departments and heads | `department-service` | `manage/departments`, `department/shifts` | Manager, Director |
| Shift definitions | `shift-service` | `manage/shifts` tab 3 (1046 lines) | Manager, HR |
| Rota (assignments, copy week) | `shift-assignment-service` (507) | `manage/shifts` tab 1, `department/shifts`, `hr/shifts` (re-exports manager page) | Manager, HR, department head |
| Clock in/out, override, undo | `clock-service` | `shifts` (staff), `manage/shifts` tab 2 (Today's Attendance), `components/shifts/ClockWidget` | staff clock; Manager overrides |
| Attendance reporting | `hr-repository.getAttendanceSummary` | `hr/attendance` (573) | HR, Manager |
| Payroll entry and publish | `payslip-service` | `hr/payroll` (1262), `manage/payslips`, `payslips` | HR, Director (edit); Manager (read branch) |
| Reading my payslip | `payslip-service`, `auth/verify-password` | `payslips` (510) + lock screen | every human role |
| Performance | not found as Workforce | `performance` (276) | not audited |

**Scatter in numbers:** 8 route files, 8 services (3,017 lines), 12 workforce models, 18 frontend pages (8,240 lines). One task is reachable from several role folders: the rota lives at `manage/shifts`, `hr/shifts` (a re-export) and `department/shifts`; "staff" is two different screens (`manage/staff` is accounts, `hr/staff` is employee records); payslips are three pages.

## 2. Code structure (short)

You already know it is scattered. The points that matter for the redo:
- Business rules sit in repositories (the 15-minute lateness threshold is a constant inside `hr-repository.ts`), against Non-Negotiable #4/#5.
- Role lists are copied into each route file (`HR_AUTHORITY`, `HR_AND_MANAGER`, `ALL_STAFF`, `MUTATION_ROLES`, `PUBLISH_ROLES` …). There is no single access table like the Central Store has.
- Pages are 500 to 1,300 lines and hold data fetching and logic, against "app/ is routing only".
- **No audit table.** Changes to hours, leave balances, payslips and records are logged to the application log or not at all.

## 3. How hours relate to pay today (verified)

- **There is no link.** Payslip `grossPay`, `paye`, `sha`, `nssfTier1/2`, `housingLevy`, `helb`, `advance`, `incentives`, `overtime`, `allowances` and `otherDeductions` are **numbers typed by hand** per person per month *(code: `payslip-service.computePayslipTotals` only adds them up; nothing computes PAYE, NSSF, SHA or the levy)*. No salary or hourly rate is stored on the employee profile. No overtime rule, grace period, rounding or break rule exists in the schema.
- **Hours are not computed anywhere.** A clock record stores in and out; nothing turns it into hours worked, overtime, or lateness minutes. The attendance report counts "late" as clock-in more than 15 minutes after shift start, using a hard-coded constant and the server's time zone *(code)*.
- **Shifts cannot cross midnight.** The API rejects a 18:00 to 02:00 shift: "startTime must be earlier than endTime" *(tested)*. A closing shift cannot be modelled.
- **Past days cannot be scheduled or corrected.** "Cannot create shift assignments for past dates" *(tested)*. A forgotten shift cannot be added afterwards, so pay cannot be made right from the rota.
- **Leave does not touch the rota.** The rota services never read leave, so someone on approved leave can be rostered, and copy-week copies them forward *(code)*.
- **Stale clock records are silently auto-closed.** On the next clock-in, any open record from a previous day is closed by the system *(code: `closeStaleOpenRecords`)*. What it closes it at, and who is told, is not recorded.

So the client's ask (hours per person that drive overtime and deductions) needs new building blocks, not a tweak.

## 4. User flows, per role

Counts are taps/clicks to finish the task from the sidebar or home screen, assuming nothing is already open.

| Role | Task | Today | Problems |
|---|---|---|---|
| Waiter/barista (phone) | Clock in | **3** *(estimated: More, Shifts, Clock In)* | Shifts sit under "More". The "today's shift" card repeats the shift inside itself. In my test the tap on Clock In showed a spinner and then returned to idle with **no request sent and no message I could see** (location was emulated, so this may be a test artefact, but a failed GPS fix must never be silent). GPS is the only method, so a phone with location off cannot clock in at all without a manager. |
| Waiter | Clock out by mistake | 60-second self-undo, then ask a manager | Good idea, but the user is told only after the window passes. |
| Waiter | See hours or what I'll be paid | **Not possible** | Attendance history lists in/out times (03:35 PM shown for a 14:00 end) with no hours, no overtime flag, no late flag. |
| Waiter | Read payslip | 2 taps + type password | Gate works well. Keep. |
| Waiter | Ask for leave | not walked | |
| Branch Manager | Define a shift | **3 clicks + 3 inputs** (Shifts, Shift Definitions tab, Add Shift, name, two times, Create) | No break time, no role requirement, no overnight. |
| Branch Manager | Build a week rota | **up to 70 actions** for 5 staff × 7 days (every cell is a native dropdown: open, pick) *(seen)*; "Copy Week" is 1 click plus a confirm *(code)* | No view of coverage per hour, cost, hours per person versus contract, or leave clashes. The week starts on Sunday. At 1440px wide the Saturday column is cut off and needs horizontal scroll. Top-right "Save now" and "All changes saved" both exist, and the footer says "Draft" even though changes auto-save. |
| Branch Manager | Correct a shift or a missing clock | Override from "Today's Attendance" tab: clock-in, clock-out or void clock-out, reason required | **Today only.** Yesterday's missed clock-out cannot be fixed. Only the last override reason is kept (single `overrideNote` field). |
| Branch Manager | See who is late or absent | Today's Attendance tab | Not walked in detail. |
| Branch Manager | Staff accounts | `Staff` page, icon-only row actions (edit, key, deactivate, **trash**) | Destructive trash icon sits beside harmless icons with no labels. Different page title font from Shifts. |
| HR Manager | Open the module | HR sidebar of 9 links, flat | "At Work Today" on the overview is **headcount minus people on leave**, not who has clocked in; it said "11 · Full team in" while nobody had clocked in *(seen; confirmed in `app/hr/page.tsx`)*. |
| HR Manager | Employee records | Staff Profiles table | **All 11 profiles show "No contract assigned", "0/13 details filled", leave left "—".** The page says "profiles are created automatically", but without a contract no leave balance exists, so leave cannot be requested properly *(seen)*. Role shown as raw `STORE_MANAGER`. |
| HR Manager | Run payroll for a branch | Payroll page: pick period, pick branch, type into a grid | **About 12 numeric columns per person, typed by hand** (gross, PAYE, SHA, NSSF tier 1, tier 2, housing levy, HELB, advance, incentives, overtime, allowances, other). Any typo changes real pay and is not flagged. Staff "see figures as drafts in real time" (the banner says so), so a half-typed figure is visible to the employee. |
| HR / Director | Reopen a published period | `revert` | Anyone with the role can unlock a period for the whole branch with **no reason recorded and no audit entry** *(code)*. |
| Director | Approve own area | not walked | |
| Dept head | Schedule own department | not walked | Built as a separate screen from the manager's rota (`department/shifts`). |

## 5. Screens (see `audit-screens/`)

- **Spreadsheet look.** Rota (`rota-branch-manager.png`), payroll (`payroll-entry.png`) and staff profiles (`hr-staff-profiles.png`) imitate Excel: dark blue title bars, sheet tabs ("Sep 20 - Sep 26"), "Export to Excel", "Expand sheet". The blue is outside the coffee palette of the new design system. This reads as "a spreadsheet inside an app" and is the opposite of premium.
- **Inconsistent headings and chrome.** Some pages use a serif page title (Staff, HR Overview), others sans (Shifts, Payroll). Two different sidebars: the Branch Manager's has a flat "Manage" group mixing Staff, Departments, Menu, Shifts, Delivery Zones and Payslips; HR has its own HR group. Nothing says "Workforce".
- **Phone.** The waiter's Shifts screen is clean and legible (`waiter-phone-shifts.png`) apart from the repeated shift card. The manager rota, payroll and staff-profile tables do not fit a phone; at ~900px they scroll sideways, and the HR bottom bar has only four slots.
- **Icon-only actions** with the delete icon in the same row as safe actions.
- **Loading.** Payroll shows a full grid of grey bars while loading and defaults to the Central Kitchen (no staff with pay), which is the first thing HR sees.
- **Useful, already good:** the payslip lock screen (`waiter-phone-payslip-gate.png`), the shift colours (morning amber, evening blue) in the rota, and the "Today's shift / Next 7 days / Attendance history" structure on the phone.

## 6. What to keep (must survive the redo)

1. **Payslip view gate**: re-enter password, server-verified, relocks on fresh visit, ~3 min idle and tab blur (`PAYSLIP_VIEW_GATE.md`).
2. **Publish and lock of a pay period** and the rule that only HR Manager/Director publish or revert (to be kept, but with a recorded reason and audit trail).
3. **Branch manager cannot approve their own leave**; it routes to Director/HR.
4. **Geofenced GPS clock-in** with a distance-based error, and the **manager override with a mandatory reason**. Keep, and make overrides appendable history rather than one overwritten note.
5. **One clock record per shift assignment** and "clock each shift separately" when someone has two shifts in a day.
6. **60-second self-undo of a clock-out** (extend the idea to other reversible actions).
7. **Department-head scoped scheduling** (a head schedules only their own department).
8. **"On shift now" feed**: the Kitchen and Barista displays list staff currently clocked in (`onShift` filter) so staff can claim tickets. Workforce must keep exposing "who is clocked in at this branch now" as a public door.
9. **Statutory fields** on the employee record (KRA PIN, SHA/NHIF, NSSF, HELB, bank) and the payslip's statutory columns. Whether they stay typed or become computed is a Phase 3 question for the accountant, not something I will decide.
10. Working-days leave calculation, leave types (annual, sick, emergency, unpaid), balances per leave year.

## 7. Verdict

The pieces for a sound module exist (clock records tied to assignments, geofence, overrides, locked pay periods, the payslip gate), but they were built as separate features. Time tracking stops at "clocked in or not"; payroll starts from blank typed numbers; nothing joins them. The screens are Excel look-alikes that are error-prone for money (hand-typed statutory figures, no confirmation of totals against hours) and unusable on a phone for managers. Fixing the client's problem (scheduling and time tracking that drive overtime and deductions) means designing the **hours layer** first, then letting payroll read from it.

## 8. Second-pass findings

| Flow | What I saw | Verdict |
|---|---|---|
| **Waiter requests leave (phone)** | More, Leave, Request, pick type, two date pickers, free-text reason (required), Submit: **about 6 taps plus typing**. The sheet itself is clean. But the balances card says "No leave balances set up yet. Contact HR to get your profile created", and the request form shows no balance, so the staff member cannot see what they have. | Form is a good base; the dead end is upstream (no contract, so no balance). |
| **Contract types do not exist on a fresh branch** | The profile says "No contract types defined yet, create one". The Staff Profiles banner says profiles are created automatically, yet leave, "Leave Left" and "Details Filled" are all empty. | Setup order is invisible. A new staff member is half-created: an account without a usable employee record. |
| **Employee profile** | Five tabs (Overview, Leave, Disciplinary, Documents, Transfers). Overview is long label/value rows with "—" everywhere. **There is no pay information on it**: no salary, no rate, no overtime eligibility, no weekly hours. Statutory and bank details sit at the bottom. | Good tab idea; the record lacks the one thing payroll needs. |
| **Discipline** | A written, free-text record ("arrived 45 minutes late on three separate occasions") with category and action. It is typed from memory; **it is not linked to the attendance records that would prove it**. | Evidence should come from time data, not recollection. |
| **Transfers** | History tab is a bare list with a transfer icon in the staff table. Transfer is Director/HR only. A transfer does not carry or close the rota, so future shifts at the old branch remain *(code)*. | Needs a rule for open shifts, leave balance and pay period on transfer. |
| **Department head scheduler (phone width)** | A **day-at-a-time** screen: scrollable day strip, "Start with Sunday", then "Add to Morning" with a checklist of eligible chefs. Plain-language scope line ("You schedule chefs only. You can't change other departments or shift times") and "HR sees what you save here". 2 taps plus one tap per person. | **Best screen in the module.** The model (one day, one shift, a checklist, scope stated) is worth carrying into the new design. Weaknesses: no week overview, no hours per person, the day strip opens on last Monday so today is at the far right. |
| **Accountant** *(code)* | The Accountant can read only their own payslip (`HUMAN_ROLES`), not branch payroll, although they are the person who must confirm statutory figures. | A gap to settle in the access table. |

## Open for your reaction before Phase 3

1. Is the "not walked" list acceptable, or do you want those flows walked first (department head, leave, discipline, transfers)?
2. Can you send a production screenshot of the rota or payroll if it looks different from my lane (it is the same code, so I expect not)?
3. Do you want me to treat the typed statutory figures (PAYE, SHA, NSSF, levy) as in scope to compute, or keep them typed until the accountant confirms the rules?
