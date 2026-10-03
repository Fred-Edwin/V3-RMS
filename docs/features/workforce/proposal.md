# Workforce — proposal (rebuilt from scratch)

Phase 3 of the design lane. Written 4 Oct 2026. Builds on `audit-and-critique.md`. Nothing here is built; all of it needs the owner's approval (Stop 2) before screens are drawn.

**Placeholders.** Every number in this document (grace minutes, multipliers, rounding blocks, thresholds) is an **example** to make the idea concrete. None is a legal or policy value. They become **settings** that HR sets and the client's accountant confirms (see §9, Rules).

---

## 1. The idea in one page

Today the module has three disconnected facts: a rota, a clock, and a payslip someone types. The rebuild joins them in one chain and removes every place where a person types hours or pay by hand.

```
  PLAN              FACT               REVIEWED TRUTH        MONEY
  Rota   ───────►   Clock events ───►  Timesheet   ───────►  Pay run  ───►  Payslip
  (promise)         (what happened)    (manager-approved)    (calculated)    (staff reads)
     ▲                                     ▲   │
     └── Leave, public holidays ───────────┘   └── Overtime approval, lateness/undertime, corrections (each with a reason)
```

Three rules hold the whole design together:

1. **The rota is the promise, the clock is the fact, the timesheet is the truth.** Payroll reads only approved timesheets. No screen lets anyone type hours, overtime or a lateness deduction into a payslip.
2. **Manage by exception.** A clean day (clocked in on time, out on time, as rostered) approves itself. Managers only look at the days that need judgement: late, left early, stayed late, missed a clock, auto-closed, outside the geofence. That is what makes it fast and what makes mistakes visible.
3. **Nothing is silent, nothing is lost, nothing is deleted.** Every clock event, correction, approval, deduction and pay change is a dated entry with who and why. Staff can see their own hours, their own overtime status and any deduction, and can **query** any line.

## 2. What the client asked for, and where it lands

| Client's words (3 Oct) | In this design |
|---|---|
| Shifts set for all staff | Rota board, one fast screen for HR, Branch Manager and department heads (§5.1) |
| System records clock-in and starts counting hours, geofenced | Clock event on tap, geofence checked, live "time on shift" counter (§5.2) |
| At shift end the system automatically clocks them out and logs hours | Auto-close at shift end **after a short, visible grace window**, never silently cutting off work (§6) |
| What if they have not finished orders or guests? | A "Still serving?" prompt at shift end. Staying on starts **overtime pending**; leaving closes the shift at once (§6) |
| Overtime must be recorded, rewarded, and **approved** so it is not misused | Overtime is recorded to the minute, **unpaid until approved**, approved by pre-approval (extend shift) or post-approval (queue) (§7) |
| Late arrival and lost time are deducted from salary | Recorded always; deducted only if the policy says so, after a grace period, after the manager can excuse it, and visible to the staff member first (§8) |
| Hours reflect in the payment module, transparent to staff | Pay run is calculated from approved timesheets, shows its working; staff see hours, overtime, deductions and can query them (§10, §5.4) |

## 3. Module structure

### 3.1 Sub-modules (named for what people do)

Backend `backend/src/modules/workforce/<sub>/`, frontend `frontend/features/workforce/<sub>/`, as Inventory does.

| Sub-module | What people do there | Owns | Replaces today |
|---|---|---|---|
| **rota** | Define shift templates, build and publish the week, set availability, swap or cover shifts | Shift templates, rota weeks, shift assignments, availability, swap requests | `shift-service`, `shift-assignment-service`, `department/shifts`, `manage/shifts` tabs 1 and 3 |
| **attendance** | Clock in and out, see who is in now, correct a missed clock | Clock events (append-only), geofence check, presence | `clock-service`, `ClockWidget`, `manage/shifts` tab 2 |
| **timesheets** | Review hours, approve overtime, excuse lateness, answer staff queries, close the period | Daily timesheet lines, overtime requests, time adjustments, staff queries | Nothing (new); parts of `hr-repository.getAttendanceSummary`, `hr/attendance` |
| **leave** | Request, approve, track balances, see the team calendar | Leave policies, balances, requests, acknowledgements | `hr-service` leave part, `hr/leave*`, `hr/my-leave` |
| **people** | Keep the employee file: profile, contract, **pay profile**, statutory IDs, documents, transfers, departments | Employee records, contract types, documents, transfers | `hr-service` profile part, `staff-transfer-service`, `department-service` membership, `hr/staff*` |
| **payroll** | Prepare, review, approve and publish a pay run; staff read their payslip | Pay runs, pay lines, payslips, bank file | `payslip-service`, `hr/payroll`, `manage/payslips`, `payslips` |
| **discipline** | Record warnings and cases, with attached evidence | Disciplinary records and their documents | `hr-service` disciplinary part |
| **rules** | Set attendance, overtime, deduction and statutory rules; public holidays | Versioned, dated rule sets, holiday calendar | Hard-coded constants (15-minute lateness), typed statutory columns |
| **audit-log** | Read the history of anything that changed hours, leave or pay | Read screen over the audit entries | Nothing (logs only) |

`_shared/` holds the access table, the audit writer, the time-calculation engine (pure functions, heavily tested) and date helpers (branch time zone, overnight shifts).

*Why discipline is separate from people:* different readers (far fewer roles) and different retention. *Why timesheets is its own:* it is the pivot. Rota and attendance feed it, payroll reads it; putting it inside either would recreate today's tangle.

### 3.2 Dependencies (point downward, never loop)

```
rules ─────────┬─► leave ─┐
people ────────┤          ├─► rota ─► attendance ─► timesheets ─► payroll
               └──────────┘                             ▲             │
leave ──────────────────────────────────────────────────┘             ▼
discipline (reads people; can link a timesheet line as evidence)   audit-log (every sub-module writes)
```

- `payroll` may read `timesheets`, `people`, `rules`. `timesheets` may read `attendance`, `rota`, `leave`, `rules`. `rota` may read `people`, `leave`, `rules`. Nobody reads `payroll`.
- Each sub-module exposes a small `index.ts`; no importing another's internals; CI fails the build on a violation (Roadmap rule 3).

### 3.3 The module's public door (what other modules may call)

| Function / event | Used by |
|---|---|
| `getOnShiftNow(unitId, role?)` | Kitchen and Barista displays (staff claiming tickets) — keeps today's behaviour |
| `getEmployee(userId)` (name, role, unit, employment status) | Orders, Inventory (who did it) |
| `isOnLeave(userId, date)` | any scheduling or assignment screen |
| `getApprovedHours(userId, period)` | Reporting (later) |
| events: `rota.published`, `clock.in`, `clock.out`, `overtime.requested`, `timesheet.approved`, `payroll.published` | Notifications & Audit |

### 3.4 Boundaries

- **Access & Organisation** owns login, role, branch/site, and the department-head marker. Workforce keeps the *employee file* and links to the user by id. An employee without a login (a casual with no phone) is **out of scope for now**; see open question 12.
- **Notifications & Audit** delivers pushes. Until its audit sink exists, `workforce/audit-log` owns a local audit table with the same shape so nothing is lost; it moves later.
- **Orders** is *above* Workforce in the dependency order, so Workforce never imports it. The "you still have open orders" hint at shift end is **composed in the phone app** (it already holds both), not in the backend.

### 3.5 Where today's services go

| Today | Goes to |
|---|---|
| `shift-service` | rota (shift templates) |
| `shift-assignment-service` | rota |
| `clock-service` | attendance |
| `hr-service` | split: people (profile, documents), leave, discipline |
| `staff-service` | stays in Access (accounts); people reads it |
| `staff-transfer-service` | people |
| `department-service` | Access owns departments and heads; rota/people read them |
| `payslip-service` | payroll |
| `hr-repository.getAttendanceSummary` and its 15-min constant | timesheets + rules |

## 4. Model sketch (for `DATA_MODEL.md`, not final)

| Entity | Notes |
|---|---|
| `ShiftTemplate` | name, start, end, **crosses midnight allowed**, unpaid break minutes, colour, required role(s) |
| `RotaWeek` | unit, week, status `DRAFT` / `PUBLISHED`, published by/at |
| `ShiftAssignment` | existing, plus status (`SCHEDULED`, `CANCELLED`), published flag, change history |
| `ClockEvent` | **append-only**: `IN`, `OUT`, `AUTO_OUT`, `CORRECTION_IN`, `CORRECTION_OUT`; `clientEventId` (idempotency), device time, server time, coordinates, method (`GPS`, `MANAGER`), reason |
| `TimesheetLine` | one per assignment-day: scheduled min, worked min, late min, early-leave min, overtime pending / approved min, break min, flags, status `CLEAN` / `NEEDS_REVIEW` / `APPROVED` / `LOCKED`; derived from events by the engine, plus reviewer decisions |
| `OvertimeRequest` | line, minutes, trigger (`PRE_APPROVED`, `STAFF_REQUESTED`, `AUTO_DETECTED`), status, decided by/at, reason |
| `TimeAdjustment` | who, what, before, after, reason (mandatory) |
| `TimeQuery` | staff-raised query on a line, status, reply, resolved by |
| `PayProfile` | pay type (`MONTHLY`, `HOURLY`, `DAILY`), base amount, standard weekly hours, overtime-eligible, deduction policy |
| `PayRun` / `PayLine` | run per unit and period, status `DRAFT` → `IN_REVIEW` → `APPROVED` → `PUBLISHED` → `LOCKED`; each line has a type (`BASIC`, `OVERTIME`, `LATENESS`, `ALLOWANCE`, `STATUTORY`, `ADVANCE`, `OTHER`), quantity, rate, amount and a **source link** (timesheet lines or rule version) |
| `RuleSet` | versioned, effective-dated settings; a pay line stores the rule version it used |
| `PublicHoliday`, `AuditEntry` | as named |

`ClockRecord` today (one row, mutable, one override note) is replaced by events so an override never overwrites what happened.

---

## 5. User flows, with the click and tap budget

"Budget" is the number I commit to. Today's figure is in brackets (measured or estimated, see the audit).

### 5.1 Build the week (HR, Branch Manager, department head)

One **rota board** for all three; the role decides the scope (department head: own department only; Branch Manager: own branch; HR: any).

| Task | Budget | How |
|---|---|---|
| Start a week from last week | **2 clicks** (today: 1 plus a confirm, with no preview) | Empty week shows "Start from last week (31 shifts, 2 clashes)"; one click copies; "Publish" is the second. Clashes (leave, deactivated staff) are shown, not copied. |
| Set a person's shift for a day | **2 clicks** (today: 2 per cell via native dropdown) | Click the cell; shift chips appear; click one. Keyboard: arrow to the cell, press `M` / `E` / `C` for the template's key, `Delete` clears. |
| Fill a whole row (a person, Mon to Fri) | **2 actions** | Pick a shift "brush" in the rail, drag across the row. |
| Build a fresh 5-person week | **≤ 12 actions** (today up to 70) | Brush + drag per person, or standing patterns ("Brian: Mon to Fri Morning") applied with one click. |
| Fix one shift after publishing | **3 clicks** | Click the shift, change, confirm the summary "Notify Brian Otieno of the change?" |
| Department head adds a day on a phone | **3 taps + 1 per person** | Keep today's best pattern: day strip, "Add to Morning", tick people, Done. Add a week-dots overview above it. |
| Publish | **1 click + confirm summary** | Names who is notified and any open warnings. |

Live checks while you build (**warn, don't block**, except leave clashes, which need a reason to override): person on approved leave; below minimum staffing for a shift; person's week hours over their contract (overtime risk); gap between shifts under a rest minimum; a double shift. Each shows as a small marker on the cell with a plain sentence on hover or tap.

Always visible: **hours per person for the week** next to the name (e.g. "38 / 48 h"), **people per shift per day** under each column, and, for roles allowed to see pay, the estimated labour cost for the day. Hours only for department heads.

Past days are read-only on the rota. Fixing the past happens in **timesheets** as an adjustment with a reason, never by rewriting the plan.

### 5.2 Clock in and out (staff, phone)

| Task | Budget | How |
|---|---|---|
| Clock in | **1 tap** (today: 3) | The Home screen shows a "Clock in" card pinned at the top from a short window before the shift; also a push-notification action. Time counts from the tap. |
| Clock out | **1 tap** + 10-second undo | Undo is one tap in the toast. After that, a manager correction with a reason. |
| See hours so far | **0 taps** | The same card shows a live counter and "scheduled until 14:00". |
| Clock in with no signal or GPS trouble | **1 tap, then waits** | The tap is saved on the phone with its time and synced when possible. If GPS cannot get a fix, the app says why in plain words and offers **"Ask my manager to confirm"** (a one-tap approval for the manager). It never fails silently. |

Reliability: each tap carries a client-generated id, so a double tap or a retry can never create two clock-ins (the server returns the first). Device time and server time are both stored; a large difference is flagged for review rather than trusted.

### 5.3 Shift end: the "still serving guests?" case (the client's question)

```
 scheduled end ─┬─► prompt on the phone: "Your shift ends now. Still serving?"
                │        [Finish now]         [Stay on]
                │            │                    │
                │      clock out at that      overtime clock starts,
                │      moment (hours =        status "pending approval"
                │      scheduled)             (manager notified)
                │
                └─► no answer within the grace window (example: 15 min)
                         auto-close AT THE SCHEDULED END, flagged "auto-closed"
                         (never later; manager can adjust with a reason)
```

- **Auto clock-out is real but gentle.** A hard cut at the exact end would delete real work and cause disputes, so the system asks first. If the person stays silent, hours are closed at the *scheduled end*, flagged, and the manager can lengthen it. Because the person never loses time without a trace, there is nothing to argue about.
- **If open orders exist**, the phone app shows "You have 2 open orders" inside the prompt (composed in the app; see 3.4).
- Anyone can still leave at once. Staying on is the only thing that creates overtime.

### 5.4 Staff see everything ("My time")

One screen, reachable in 1 tap from Home:

- Today: live counter, scheduled vs actual.
- This week: hours worked vs scheduled, as a simple bar per day.
- **Overtime**: pending, approved, declined (with the manager's reason).
- **Lateness / time lost**: minutes, whether it is excused, and the **estimated deduction this period** *before* payroll runs.
- Every line has **Query** (2 taps): attaches the shift and a note, notifies the manager, the reply returns to the same line.
- Payslips (kept: password gate, relock on idle and tab blur) now open onto "how this was calculated" with links back to these lines.

### 5.5 Manager's day: Today board and timesheet review

**Today board** (replaces "Today's Attendance"): a card per shift with who is *in*, *late* (with minutes), *not in yet*, *stayed on*. One-tap actions on a person: "Clock in for them (reason)", "Mark absent", "Extend shift to 15:00" (pre-approves overtime), "Message".

**Timesheet review** (weekly, per unit):

| Task | Budget | How |
|---|---|---|
| Approve a normal week | **1 click** | "Approve all clean days (87)". |
| Decide an exception (late, early leave, overtime, missed clock) | **1 to 2 clicks each** | Row shows scheduled vs actual as a small timeline bar and the system's suggestion; one click accepts, or choose "Excuse" or "Adjust" with a reason chip (pick from list; free text optional). |
| Fix a missed clock-out | **3 clicks** | Open the exception, set the time, pick a reason, Save. Works for any past day in an open period. |
| Close the period | **1 click + confirm** | Blocks if unreviewed exceptions remain; names them. |

Exceptions older than a set number of days escalate to the next approver (HR) automatically, so nothing hangs.

### 5.6 Leave

| Task | Budget | How |
|---|---|---|
| Staff request | **4 taps** (today: ~6 + typing) | Leave → pick dates on one calendar (range) → type shown with balance ("12 days left") → Send. Reason only when the policy requires it. |
| Approve | **1 tap** from the notification or queue | Card shows who else is off that day and the rota impact. |
| Manager's own leave | goes to HR or Director (kept) | |

Approved leave automatically blocks the rota cell, counts as scheduled paid hours in the timesheet, and a new employee **gets balances immediately** (see people below), fixing today's dead end.

### 5.7 People (HR)

| Task | Budget | How |
|---|---|---|
| Add an employee | **1 guided flow, 5 short steps** | Account (from Access) → role/unit → contract → **pay profile** → statutory and bank. A progress ring shows what is missing; leave balances and payroll eligibility appear only when the record is complete, so no half-created person. |
| Transfer | **3 clicks + summary** | Summary lists the open shifts at the old unit (moved or cancelled), leave balance (carried) and pay period (split). |
| Record a warning | **3 clicks** | Pick the employee; the form offers *attach attendance evidence* (late arrivals pulled from timesheets) instead of retyping them. |

### 5.8 Payroll (HR, Accountant, Director)

| Task | Budget | How |
|---|---|---|
| Prepare a run | **1 click** when everything is approved | "Start June pay run for Nyeri Town" reads approved timesheets and pay profiles. |
| Review | per exception, 1 click | Only unusual lines show: change vs last month beyond a set %, new joiner, leaver, missing pay profile, unapproved overtime. |
| Approve | **1 click** (Accountant) | Preparer cannot approve their own run. |
| Publish | **1 click + confirm summary** (HR or Director) | Staff see payslips **only after publish** (today they see drafts live). |
| Reopen a published run | **2 clicks + reason**, Director only | Audited; staff notified. |

Each payslip line **shows its working**: "Overtime: 3 h 40 min × rate × 1.5 (rule version 4)". The statutory deductions follow Open question 11.

---

## 6. How the hours engine works (the pure-function core)

Input: the assignment (planned start/end, break), the clock events, the leave, the holiday calendar, the rule set. Output: one timesheet line. A worked example, with **placeholder** rules (grace 5 min, overtime block 15 min, example rates):

| | |
|---|---|
| Scheduled | 06:00 to 14:00, 30 min unpaid break = 7 h 30 min paid |
| Clock events | IN 06:22, OUT 15:35 (staff chose "Stay on" at 14:00) |
| Late | 22 min (beyond 5-minute grace) |
| Worked | 06:22 to 15:35 = 9 h 13 min, minus 30 min break = 8 h 43 min |
| Beyond scheduled end | 14:00 to 15:35 = 1 h 35 min, rounded down to 1 h 30 min in 15-minute blocks → **overtime pending 1 h 30 min** |
| Regular paid hours | 7 h 30 min − 22 min late = 7 h 08 min (if the policy deducts; otherwise 7 h 30 min) |
| Status | `NEEDS_REVIEW`: late + overtime pending |

The engine is deterministic and dated: change a rule and only *future* lines change; each line records the rule version it used, so a past period can be reproduced exactly.

## 7. Overtime: structure and approval

Recommended policy (all of it settings, defaults chosen to prevent misuse):

- **What counts:** time worked beyond the scheduled end, in blocks (example 15 min). A second trigger, hours beyond the weekly contract, can be switched on for hourly and part-time staff.
- **Three ways it starts:** (1) *Pre-approved*: a manager extends the shift (1 tap on the Today board) or the rota; (2) *Staff-requested*: the person taps "Stay on" at shift end; (3) *Auto-detected*: they simply stayed and clocked out late.
- **Approval:** the Branch Manager (or the department head for their own department, if allowed by setting) approves within a window (example 48 h). **Unapproved overtime is recorded, shown to the staff member as "pending", and not paid.** It is never deleted. After the window it escalates to HR.
- **Nobody approves their own.** A Branch Manager's overtime goes to HR or the Director.
- **Reward:** paid at a multiplier by day type (normal day, rest day, public holiday) taken from the rule set. Time off instead of pay (TOIL) is a possible option, off by default.
- **Weekly cap** (setting): a warning to the manager when a person approaches it.
- **Salaried staff:** overtime only if their pay profile says "overtime-eligible". Hours are still tracked.

## 8. Lateness and undertime

- **Always recorded** (late minutes, early-leave minutes, missed shifts) with the clock events as proof.
- **Deducted only if the policy says so.** Policy options, per contract type: *Record only*, *Warn first then deduct*, *Deduct from the first minute beyond grace*. Deduction = minutes × the person's hourly equivalent, shown as a pay line `LATENESS` with its working.
- **Excuse before it bites:** the manager can excuse a line (reason chip: transport disruption, asked to come later, system fault…); excused minutes never deduct.
- **Transparent first:** the staff member sees "estimated deduction this period" in My time as it accrues and can Query it. Nothing is deducted that was not visible and reviewable.
- **Law:** the Employment Act limits what may be deducted from wages and how. This is for the accountant or the client's lawyer to confirm. The system makes the policy a setting and keeps the evidence; it does not decide what is lawful.

## 9. Rules (settings) — all editable, dated, versioned

| Group | Examples (placeholders) | Who edits | Who confirms |
|---|---|---|---|
| Attendance | grace minutes, auto-close window, geofence radius, clock-in opens N min before | HR | Director |
| Overtime | trigger, block size, multipliers by day type, weekly cap, approval window, who approves | HR | **Accountant** |
| Lateness policy | record / warn / deduct, per contract type | HR | **Accountant** |
| Breaks | default unpaid break per shift template | HR | Director |
| Statutory | PAYE bands, SHA, NSSF tiers, housing levy, reliefs, effective dates | **Accountant** | Accountant (HR reads) |
| Holidays | public holiday calendar | HR | Director |
| Week | first day of week | HR | |

Changing a rule never edits history: it creates a new version from a chosen date.

## 10. Mistake-proofing, designed in

- **Validate and explain before submit, in plain words** (no codes). Sensible defaults everywhere; **choices, not typing** (shift chips, reason chips, date ranges, steppers).
- **No hand-typed hours, overtime, or lateness anywhere in payroll.** The only free numbers a payroll user types are explicit `ALLOWANCE`/`ADVANCE`/`OTHER` lines, each with a reason, and each flagged in the run's review step.
- **Locked states.** Past rota weeks are read-only. A closed timesheet period and a published pay run are locked; reopening needs a role (Director for pay), a reason, and notifies the affected people.
- **Undo windows.** Clock-out 10 s; rota edits Ctrl/Cmd+Z with a toast "Shift removed · Undo"; leave and overtime decisions undoable by the decider for 1 h while the period is open.
- **Confirm summaries for the irreversible-ish:** publish a rota, approve a timesheet period, publish a pay run, transfer an employee. Each names the people and amounts affected ("Publish June pay for 8 people at Nyeri Town, net total KSh …").
- **No permanent deletion.** Archive / cancel / void with a restore; a destructive icon never sits next to safe ones; icon-only actions get labels.
- **Reason recorded** for every correction, override, excuse and reopen (chip list plus optional note), written as its own entry, never overwriting the previous one.
- **Segregation of duties:** no one approves their own overtime, leave or timesheet; the person who prepares a pay run is not the one who approves it.
- **Audit trail:** every change to hours, leave balances, pay, records, and rules is an `AuditEntry` (who, when, before, after, reason), readable in `audit-log`.
- **Reliability:** idempotent clock events; offline queue for clock taps; money in decimal; calculations deterministic and reproducible from the stored rule version; every pay figure links back to its source lines.

## 11. Screen and interaction direction

- **Navigation.** A new **Workforce** sidebar, in the approved file-tree pattern (spine from each group label, branches, chevrons; links a role cannot open are hidden):
  ```
  Workforce
   ├ Today
   ├ Schedule        Rota · Shift templates · Swaps & open shifts
   ├ Time            Timesheets · Overtime · Queries
   ├ People          Employees · Leave · Discipline
   ├ Pay             Pay runs · Payslips
   └ Settings        Rules · Audit log
  ```
  Phone staff get **My shift & clock** on Home and in the bottom bar (not hidden under "More"), then **My time**, **Leave**, **Payslips**.
- **Look.** Retire the Excel look: no blue title bars, sheet tabs or "Export to Excel" as the main interface. Use the design-system tokens, cards and chips, generous spacing, clear hierarchy, today highlighted, one accent. Tables only where they really are tables.
- **Rota board.** Person rows with avatar and weekly-hours chip; day columns (week starts on a setting, Monday by default); shift chips in the template colours; coverage strip and (permitted) cost strip; sticky "Draft · 3 changes · Publish" bar; keyboard-first for desktop, day-at-a-time for phone.
- **Today board, Timesheet review, Pay run** as in §5; exceptions first, bulk approve for clean rows, working shown on demand.
- **States kit.** One reusable loading / empty / error kit and a copy table (as for Inventory), not an artboard per screen per state.
- **Interaction spec.** One artboard, "Workforce · Interaction spec" (triggers, response, timing and easing, every state, offline, undo windows, keyboard), built in Phase 4 with the `emil-design-eng` skill.

## 12. Access (draft; edit `ROLE_CAPABILITIES`, nothing else)

One table in `backend/src/modules/workforce/_shared/workforce-access.ts`, read by the routes, services and the front end (`GET /workforce/permissions/me`), as for the Central Store. Scope in brackets: own = self; dept = own department; unit = own branch or site; all = company.

| Capability | Staff | Dept head | Branch Mgr | HR Mgr | Accountant | Director | Sys Admin |
|---|---|---|---|---|---|---|---|
| Clock in/out (self) | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| See own shifts, hours, overtime, payslips | own | own | own | own | own | own | own |
| Query a timesheet line | own | own | own | own | own | – | – |
| Read rota | own | dept | unit | all | – | all | all |
| Edit rota / publish | – | dept | unit | all | – | – | all |
| Shift templates | – | – | unit | all | – | – | all |
| Today board, clock for someone, extend shift | – | dept | unit | all | – | read | all |
| Timesheet review / approve | – | dept (setting) | unit | all | read | read | all |
| Overtime approve | – | dept (setting) | unit | all (for managers) | – | read | all |
| Leave request | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| Leave approve | – | – | unit (not own) | all | – | all | all |
| Employee file: basic (name, role, unit) | – | dept | unit | all | all | all | all |
| Employee file: full (IDs, bank, documents) | own | – | – | all | read | read | all |
| **Pay profile** (rate, contract pay) read / write | own read | – | – | all / write | read / –| read / – | all |
| Rules: attendance, overtime, breaks, holidays | – | – | read | write | **confirm** overtime & lateness | confirm | all |
| Rules: statutory | – | – | – | read | **write** | read | all |
| Pay run: prepare | – | – | – | all | – | – | all |
| Pay run: approve | – | – | – | – | **✓** | ✓ | all |
| Pay run: publish | – | – | – | ✓ | – | ✓ | all |
| Pay run: reopen | – | – | – | – | – | **✓ (reason)** | ✓ (reason) |
| Pay runs: read | – | – | unit (totals only, setting) | all | all | all | all |
| Discipline: read / write | own read | – | unit read / write | all | – | read | all |
| Audit log | – | – | unit (own area) | all | all | all | all |

Store Manager and Store Attendant are treated as Branch Manager and Staff of the hub unit. A Branch Manager's own hours, overtime and leave are decided by HR or the Director.

## 13. Alternatives I considered and rejected

| Alternative | Why rejected |
|---|---|
| Hard auto clock-out at the exact shift end, no prompt | Silently deletes real work, causes disputes, and trains people to ignore the system. |
| Pay all time beyond the shift automatically | Exactly the misuse the client wants to prevent. |
| Let payroll users edit hours or overtime in the pay grid | Re-creates today's untraceable numbers. Corrections go through timesheets, with a reason. |
| Keep the spreadsheet grid, only restyle it | The cost is in the 70 actions and the hidden clashes, not the colour. |
| One screen per role for the rota | Four copies of the same logic; one board with role scope is cheaper and consistent. |
| QR code or kiosk clock-in now | GPS is already there and works; add a kiosk later for staff without phones. |
| Fully automatic lateness deduction, no review | Legally and humanly risky; the review step is what makes it fair and fast. |
| One big `workforce` module with no sub-modules | Recreates the current scatter. |
| Put timesheets inside payroll | Staff and managers need hours long before payroll exists; the hours are useful on their own. |

---

## 14. Open questions for the owner (each with my recommendation)

1. **Auto clock-out.** Prompt first, then close at the scheduled end if no answer? *Recommend yes, grace window 15 min (setting).*
2. **What counts as overtime.** Beyond the scheduled end only, or also beyond weekly contract hours? *Recommend the first by default; the second available for hourly and part-time.*
3. **Approval timing.** Before (extend shift) or after (queue), within how long? *Recommend both allowed; 48 h window; unapproved is recorded but unpaid and never deleted.*
4. **Reward.** Pay multiplier or time off? Which multipliers per day type? *Recommend pay as default; multipliers entered as settings by HR and confirmed by the accountant against the Employment Act. I have not hard-coded any.*
5. **Lateness deduction.** Record only, warn first, or deduct from the first minute? Grace? *Recommend record always, deduct only per contract policy, 5-minute grace as an example; accountant or lawyer to confirm what the law allows.*
6. **Breaks.** Fixed unpaid break set on the shift template, or staff tap break start and end? *Recommend fixed per template: fewer taps, fewer disputes.*
7. **Who builds the rota.** *Recommend Branch Manager (any role in the branch), department heads for their own department, HR for any; staff set availability, not shifts.*
8. **How staff clock in.** *Recommend keep GPS geofence, add "Ask my manager to confirm" fallback, defer kiosk.*
9. **Pay types.** Monthly salary, hourly, and daily (casual). *Recommend all three in the pay profile.*
10. **Leave and holidays in hours.** *Recommend approved leave and public holidays count as scheduled paid hours; a shift worked on a holiday uses the holiday multiplier.*
11. **Compute statutory deductions (PAYE, SHA, NSSF, housing levy)?** *Recommend yes, from dated tables the accountant enters and confirms. Until confirmed, payroll runs in "statutory typed" mode with a banner. I need your decision, and the accountant's, before the payroll design is drawn.*
12. **Employees without a login** (casuals without phones). *Recommend out of scope now; every employee has an account; add a manager-run kiosk later.*
13. **Week start.** *Recommend Monday, a setting.*
14. **Audit location.** Local `audit-log` until the Notifications & Audit module exists? *Recommend yes.*
15. **Overnight shifts and time zone.** *Recommend allow overnight; store times in UTC, read in the branch's time zone.*

## 15. Proposed order for Phase 4 (workflow by workflow)

The client's priority is schedule and time first, then hours to pay, then the people screens.

| # | Workflow | Why here |
|---|---|---|
| 1 | **Rota** (build, copy week, publish, department-head day view) | Everything starts with the plan |
| 2 | **Clock and My time** (staff phone: clock in/out, shift-end prompt, my hours, query) | The record of what really happened and the transparency the client asked for |
| 3 | **Today board and Timesheets** (exceptions, overtime approval, lateness, period close) | Where hours become decisions |
| 4 | **Payroll** (pay run, working shown, payslip, staff gate) | Needs 1 to 3, plus the statutory decision (Q11) |
| 5 | **People** (employee file, pay profile, add employee, transfer) | Pay profile is needed by 4; the record screens follow |
| 6 | **Leave** | Feeds the rota and timesheets; mostly a restyle of what works |
| 7 | **Discipline** | Small; reads timesheets for evidence |
| 8 | **Rules and Audit log** | Settings screens; each earlier workflow already shows its rule inline |

Each workflow: its own Paper page, desktop plus phone where used, owner approval recorded in the sub-module README before the next starts. Plus the single "Workforce · Interaction spec" artboard.
