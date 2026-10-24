# How Shifts and Attendance work (plain words)

Written 24 Oct 2026 from the approved Paper frames, the module notes and a few checks of the code. Nothing here comes from watching the product run yet; where a rule is "by design" it means the notes and tests say so, not that anyone has seen it on screen.

## What they are for
**Shifts** is the plan: who works which shift on which day, at each branch. **Attendance** is what really happened: who clocked in, when they left, who was late, and how a mistake is put right. The plan feeds the clock; the clock feeds Timesheets, and Timesheets feed Payroll (those two come in the next sections).

## Who does what
- **Branch Manager** builds the week for their own branch and sees the Today board on their Home. They can clock someone in who has no phone or could not clock in, and they fix time with a reason.
- **Department head** plans their own team's week on a phone (pick a day, a person, a shift). They see only their departments, and they cannot create shift types or fix time.
- **Staff member** sees their own shifts and clocks in and out on a phone.
- **HR** can build or edit any branch's shifts and any shift type, can fix time, including after a pay period has closed.
- **Director and System Admin** have full access to Workforce since the access change of 21 Oct 2026: both can edit shifts, add company-wide shift types, clock someone in, fix time, and turn the new clock on or off for a branch (each cannot change their own time).
- The Accountant and Store Attendant have no week to edit; they see only their own shifts.

## The normal week, step by step
1. **Shift templates**: the shift types the branch uses (for example Morning 06:00 to 14:00, Afternoon 14:00 to 22:00). Each has times, an unpaid break, a colour, and which departments may use it. A shift type is retired, never deleted. There are no overnight shifts.
2. **Shifts** (the weekly grid): people down the side, days across, one cell per day. Click a cell, pick a shift or "Day off". Drag across a row to fill a week. Every change is saved at once. There is no publish step.
3. **Start from last week**: shows how many shifts and people would be copied and which ones clash (a person on approved leave, or sent to another branch that day). Clashes are never copied, and cells that already hold a shift are kept.
4. **A change for today or tomorrow** asks for a short reason, and the dialog says who is told.
5. **Staff are told** once, about five minutes after the last change, not after every click.
6. **Print**: one landscape page for the notice board, colour-coded by shift, with no pay on it.
7. **On the day**, the branch's Home shows the **Today board**: how many are on shift, late, not in, and on leave, a list of who needs a look, and a line for each department.
8. **The staff phone** shows one card: before the shift, a countdown and **Clock in**; during the shift, a timer; near the end, a heads-up; after the end, the **shift-end prompt**.
9. **Fixing time**: a manager opens a person from the board, or their day, and edits, adds or removes a clock event.

## Rules the system enforces
- **Who may edit a week**: the access table decides by capability, not by role name. A branch manager edits their own branch only; a head edits only departments they head. Another branch's person answers "not found", an action you may not do answers "forbidden".
- **Past days are read-only** on the shifts grid. Fix a past day through Attendance.
- **Warnings inform and never block**: approved leave (a shift on a leave day needs a saved reason), thin cover (against the minimum cover set in Rules), weekly hours above the contract, and a double shift.
- **Minimum cover** is stored in the Rules, in one place; the grid only reads it.
- **Clock in** opens 15 minutes before the shift (the screen says "Clock in opens at 05:45") and the phone checks the person is at the branch. A repeat tap or a retry makes one clock event, not two.
- **Two-minute undo**: a person's own newest tap can be undone for two minutes. Nothing is deleted; a cancelling entry is recorded. After that, they ask their manager.
- **Leaving early** asks for a reason (sent home, unwell, emergency, other).
- **The shift-end prompt exists** so overtime is never an accident: when the shift ends the person must say Finish now or Stay on with a reason. If nobody answers for 15 minutes, the system closes the shift at the scheduled end and flags it for the manager. A clock-in left open past midnight is closed the same way. The prompt also lists what is still open in the person's job (open tables for a waiter, tickets for a barista or chef, dispatches for a store attendant) but never stops them finishing.
- **No signal**: the tap is kept on the phone with its real time and sent when the signal returns. A phone whose own clock is wrong is flagged, and every counter runs on the server's time in Nairobi.
- **Who may fix time**: Branch Manager and Store Manager (own branch), HR, the Director and the System Admin (all). Always with a reason of at least three characters. Nobody can change their own time. A fix must not leave a clock-out without a clock-in.
- **What is kept**: every clock event is append-only (the database refuses changes). A fix adds a correcting entry that points at the old one; the old value stays visible in the history, and the person is told what changed and by whom. The preview shows the day before and after, in minutes.
- **Lateness** is computed in Nairobi time from the first clock-in of each shift, using the grace minutes in Rules. It is data only; no pay deduction exists yet.

## The switch and the old clock
Each branch has a switch, **off by default**. While it is off the old clock is the only clock and nothing new shows. The Director or the System Admin turns it on per branch (decision of 21 Oct 2026; earlier notes said System Admin only).
- **On**: refused while anyone is still clocked in on the old clock. Otherwise today's finished old records are carried over, and the four old clock routes stop working for that branch (they answer "moved to new attendance").
- **Off**: today's new clock events are written back as old records so the old clock keeps working, and anyone whose shift exists only in the new plan is listed.
- Past days stay with whichever clock recorded them. In this lane's data the switch is on for the two demo branches.

## How it connects to the next sections
- **Timesheets** (section 3): the clock events and lateness feed the timesheet; "clocked out by mistake" requests and overtime approval arrive there. Today the person is told to ask their manager.
- **Payroll** (section 5): reads the timesheet, not the clock directly. Until then, the pay-period lock is not active.
- **Leave** (section 7): will fill the "on leave" figures and the leave warning on the grid.

## What is deliberately not built
No publish step on shifts. No "mark absent today" (no endpoint). No request flow for "clocked out by mistake" yet. No overtime approval, no deductions for lateness, no pay-period lock (Timesheets). No leave data on the grid or board until Leave exists. No overnight shifts. No notification inbox in Workforce: notices go to the bell and Latest. No camera or photo checks on the clock, only the location check. Shift change notices are logged only until the notifications module delivers them.
