# Workforce final pass, section 2: Schedule, change log for the orchestrator

Started 24 Oct 2026 in the orient session (lane 4). **This is the hand-off file.** It collects every change the owner asked for or agreed to for Shifts and Attendance. The watch (step 2) adds its findings in section H. After the watch the orchestrator turns this file into the Decide step, then design, then build. Nothing here is built or drawn yet. Companion files: `2-schedule-carry-forward.md` (predicted changes, gaps, coverage list), `2-schedule-how-it-works.md` (how it works today), and `2-schedule-walk-feedback.md` (written during the watch).

Status words: **Agreed** = the owner said yes. **Proposed** = my suggestion, not yet confirmed. **Open** = a question.

## A. Owner decisions so far (24 Oct 2026)

| # | Decision | Status |
|---|---|---|
| D1 | Redesign the **department head's Home**, so it holds many elements and reflects every part of their role | Agreed |
| D2 | Redesign the **Home of staff who are not heads** | Agreed |
| D3 | The big **clock card** takes too much vertical space: make it compact on both Homes | Agreed |
| D4 | Redesign the **"This week" card** | Agreed |
| D5 | **"Start from last week" needs clearer wording** for a new user. Only the words change, no redesign | Agreed |
| D6 | Open permission to improve any design I find weak while redrawing; Paper is drawn and approved before anything is built | Agreed |
| D7 | **The system clocks everyone out at the scheduled end** unless overtime was approved beforehand | Agreed |
| D8 | **Overtime is requested before it is worked**, from the phone, and the department head decides | Agreed |
| D9 | If the head does not answer, the default is **hand over and clock out**, never automatic approval | Agreed |
| D10 | A person handing over may choose **any person on the next shift, or the head** | Agreed |
| D11 | **No automatic deductions.** Unaccounted orders are flagged and shown. What happens next is for the people who follow up (the Accountant, the managers) | Agreed |
| D12 | Unaccounted orders are visible to the **staff member responsible, the Branch Manager, the Director and the Accountant** | Agreed |
| D13 | Approved overtime records the **hours worked and the orders completed** (waiters, chefs, baristas) | Agreed |
| D14 | The whole shift-end, handover and overtime work goes into the batch with its own design and build, **not built before the watch** | Agreed |
| D15 | An item still open **30 minutes after** the person was clocked out, with nobody taking it, becomes **Unaccounted** | Agreed (owner, 24 Oct) |
| D16 | A hand-over needs the receiving person to **tap to accept**; until then the item shows under both names | Agreed (owner, 24 Oct) |

## B. The new shift-end flow (plain words)

1. **Ten minutes before the scheduled end**, the phone shows "Your shift ends at 14:00" and lists what is still open in the person's own job: unpaid tables for a waiter, unfinished tickets for a chef or barista, unpacked dispatches for a store attendant. Three choices: **Finish them**, **Hand over**, **Ask for overtime**.
2. **Finish them:** the person closes or completes the items. The shift ends normally.
3. **Hand over:** the person picks a person who is on the next shift, or the head. That person is told and sees the items under their name. The person handing over is clocked out at the scheduled end.
4. **Ask for overtime:** one tap, with a reason and an estimate (15, 30 or 60 minutes). The head gets it with the list of open items and approves or declines. The person is told either way.
5. **At the scheduled end, with no approved overtime:** the system clocks the person out. Anything still open is not lost. It moves to **Needs an owner** on the head's list, and the head and the person are told.
6. **With approved overtime:** the clock stays open until the approved time. The hours worked and the orders completed in that time are recorded as the evidence for the overtime.
7. **If the head does not answer a request in time:** the person is handed over and clocked out at the scheduled end (D9). A late approval does not reopen a closed shift. The head can still record overtime afterwards through Fix time, with a reason.

## C. Orders that are still unaccounted for, and who sees them

**Why orders can still be left even with automatic hand-over:** the system cannot choose an owner. Handing over is a choice by the person. Orders are left behind when the person taps nothing, the person they chose is not on shift or never opens it, a table is closed but never marked paid, or a ticket is stuck by a fault.

**Rule (agreed, D15):** an item that is still open **30 minutes after** the person was clocked out, with nobody taking it, becomes **Unaccounted**. A hand-over counts as taken only once the receiving person has tapped to accept (D16).

| Who | What they see | Why |
|---|---|---|
| **The staff member responsible** | A notice and a line in their own record: "Table 4, KES 2,350 unpaid, still open after you clocked out" | They can still explain or act |
| **The department head** | "Needs an owner" immediately, then "Unaccounted" if it stays open | They assign it or close it |
| **Branch Manager** | The branch's Unaccounted list, with who, what, value and age | Branch follow-up |
| **Director** | The same list across branches, read only | Oversight |
| **Accountant** | A reconciliation list: item, person, value, age, and a status the Accountant sets (Open, Explained, Recovered, Written off) with a note | The Accountant follows up money; the decision is theirs |

Nothing is ever deducted by the system (D11). A repeated pattern for one person shows as a flag for managers, not as a penalty.

## D. What changes in what is already built

| Part today | Change |
|---|---|
| Shift-end prompt after the end: Finish now or Stay on with a reason | Replaced by the 10-minute warning with Finish them, Hand over, Ask for overtime |
| Auto-close at the scheduled end after 15 minutes, flagged "Needs a look" | Becomes the normal clock-out at the scheduled end; the flag is kept only for forgotten clock-ins |
| "Stay on" reason chips (4) and estimate | Become the overtime request (reason and estimate), sent before the end |
| Leftovers list (information only, never blocks) | Becomes the centre of the flow; needs a Hand over action for all three jobs |
| Overtime approved afterwards on the timesheet (section 3) | Becomes approved beforehand; Timesheets must be redesigned to read approved overtime and its evidence |
| Notification table (Paper, Shared step 3): "Shift ends unanswered (auto-closed)" | Replace with: hand-over received, overtime requested, overtime approved or declined, item unaccounted |
| "Clock-out fix" and "Shift auto-closed" cards in Needs you | Fewer auto-closed cases; add "Overtime request" and "Needs an owner" cards |

## E. Work to do (for the Decide step: design, then build)

| # | Item | Size | Needs a Paper design? |
|---|---|---|---|
| W1 | Department head Home (desktop and phone), with the head's own clock, team today, their team's shifts, overtime requests, items needing an owner, probation reports, requisitions | L | yes (D1) |
| W2 | Staff Home (desktop and phone) | L | yes (D2) |
| W3 | Compact clock card, both Homes, including the ten-minute warning state | M | yes (D3) |
| W4 | "This week" card | S to M | yes (D4) |
| W5 | Shift-end flow on the phone: the warning, Finish them, Hand over (person picker, uses the person label), Ask for overtime, the clocked-out result | L | yes |
| W6 | The head's approval screen: overtime request with open items, approve, decline, and the "Needs an owner" list with Assign | L | yes |
| W7 | Handover received: what the receiving person sees | S | yes |
| W8 | Unaccounted items lists for the Branch Manager, the Director and the Accountant, with the Accountant's reconciliation status and note | L | yes |
| W9 | Overtime evidence: hours and completed orders shown at approval and on the timesheet | M | yes (with section 3) |
| W10 | Back end: overtime requests (create, decide, expire), handover records, the scheduled-end clock-out job (replaces the 15-minute auto-close), the Unaccounted sweep and its status, notifications, new access-table capabilities for each role in C, audit entries for every step | L | no |
| W11 | Back end: link orders and prep tickets to a handover and to overtime (who completed what, and when) | M | no |
| W12 | Reword "Start from last week" on the dialog and in Paper frame 03 | S | no (copy only) |
| W13 | Tests, including the clean-database flows for every rule in B and C, and the docs for both modules | M | no |

**Order I suggest:** decide, then design W5 to W9 together with W1 to W4 (the Home carries the new states), then build the back end (W10, W11) and the front end in parallel lanes with a stay-out list, then the Timesheets redesign in section 3 reads the same overtime records.

## F. Open questions for the Decide step

| # | Question | My suggestion |
|---|---|---|
| Q1 | ~~How long before an item becomes Unaccounted?~~ | **Decided, D15: 30 minutes after clock-out** |
| Q2 | ~~Does a hand-over need the receiving person to accept?~~ | **Decided, D16: a tap to accept; until then the item shows under both names** |
| Q3 | Can a person be handed items if they are not clocked in? | Only if they are on the next shift, and they see the items when they clock in |
| Q4 | Who may set the Accountant's reconciliation status? | The Accountant only; the Director reads |
| Q5 | Do staff without a phone (no clock on a phone) follow the same flow? | The Branch Manager records overtime and hand-over for them |
| Q6 | Where does the value of an unpaid table come from? | The order total in Orders; confirm with the owner |
| Q7 | The lawyer's view on any later deduction | Not needed now; no deduction is built |

## G. Simplification questions (from the owner's request, 24 Oct 2026)

Raised as questions only; nothing is removed until the owner decides.
1. One fix path for "closed by the phone", "clocked out by mistake" and a missed clock-in.
2. Remove "Mark absent today" and "Wait, they have told me" (no back end; saves nothing).
3. Keep the end-of-shift list of open items for all three jobs (now central), but keep it to one line per item.
4. Plan to remove the per-branch switch and the old-clock bridge once every branch is live.

## I. From the Branch Manager watch (24 Oct 2026)

Decisions (owner, in the Branch Manager part of the watch):

| # | Decision | Status |
|---|---|---|
| D17 | Cells on the Shifts grid show the **timings** (06–14), not the shift names. The name stays in the tooltip, the picker and the legend. Reverses the 18 Oct decision to show names | Agreed |
| D18 | The **reason is optional** when editing a shift, including for today and tomorrow. The dialog stays as a light "who is told" confirmation, with Save always enabled. Reverses rota backend decision R3. The leave-override reason is a separate question (see Q8) | Agreed |
| D19 | The "Closed by the phone at 22:00" notice and its dialog are **retired** once the new shift-end flow exists, because the system clocks people out at the scheduled end. What remains is the "Needs an owner" and "Unaccounted" lists (section C) and a small check for an approved overtime that ran past its approved end | Agreed in principle, to confirm |

Proposals the owner asked for (not yet agreed):

**P1. Actions on late and not-in staff, consequential to the timesheet.** Each late row on the Today board and each late day on the timesheet gets the same actions:
- **Excuse**, with one reason chip (transport, unwell, permission given, work reason, other). The late minutes are marked excused on the timesheet.
- **Counts**, the default: the late minutes stay as late minutes on the timesheet. What Payroll does with them is set by the Lateness rule that the Director owns; this change adds no new deduction.
- **Make up the time**: the person works the minutes back; the Branch Manager records when, and the minutes are cleared when done.
- **Note for conduct**: after a set number of lates in 30 days (a number in Rules, suggest 3) the row shows "3rd late in 30 days" with a button that starts a Conduct note. Never automatic.
- For **not in**: Clock in for them (exists), **Mark absent** (with leave, sick, unpaid or no reason), **Wait**.
The person is told what was decided and by whom. Every decision is audited. Undecided late minutes count until decided; the Branch Manager can decide any time before approving the month, and an undecided item shows as "To decide" on the timesheet. Needs a Paper design. Size L (design, back end for lateness decisions and make-up, the timesheet reading them).

**P2. Showing days that have passed on the Shifts grid.**
- A **Today** column: amber top rule and the label TODAY, light tint.
- **Past columns** muted: grey tint, lighter ink, a small lock on hover with "Past days are read-only"; the picker will not open.
- Future columns normal.
- Optional second step: a small dot under each past shift for what happened (green worked, amber late, red absent), from the clock data.
Needs a small Paper design. Size M.

**P3. Setting shifts fast, for a week or a month.** A "Plan shifts" mode on the Shifts page, no other page needed:
- A **palette** of shifts on the left (Morning, Mid-day, Afternoon, Day off, plus Add shift in place). Pick one, then click or drag over any cells. Letter keys still work.
- **Row actions:** "Repeat this person's week for the next N weeks"; "Set this person's pattern" (for example 5 on 2 off, Morning).
- **Column actions:** "Everyone on Morning on Monday"; the existing Copy day.
- **Saved week patterns** for the branch ("Normal week", "Festive week"): save a week as a pattern, apply it to one week or to a whole month in two clicks, with a preview of clashes (leave, loans) before anything is written.
- A **month view** (people by days, 28 to 31 columns) to paint and to apply patterns.
- **Fill the gaps:** on a thin day, a list of who is free (not on leave, under contract hours) with one-click add.
- **Undo** the last bulk change for ten minutes.
- "Shift types" becomes a pop-over inside the palette; the separate page stays for deeper edits.
Needs a Paper design. Back end: saved week patterns, month reads, bulk apply with preview, undo; the standing-pattern endpoint already exists and has no screen. Size L.

Open questions from this part:

| # | Question | My suggestion |
|---|---|---|
| Q8 | Does the leave-override reason stay required (it overrides approved leave)? | Yes, required; it is a different act from a normal edit |
| Q9 | Should "Counts" be the default for late minutes, with Excuse needing a reason chip? | Yes |
| Q10 | Should past columns show what happened (the dots)? | Yes, as a second step |
| Q11 | Saved week patterns: per branch, or company-wide too? | Per branch first |

New work items: **W14** cells show timings (S); **W15** optional reason on shift edits, dialog change (S); **W16** retire the closed-by-phone notice and dialog with the shift-end work (part of W5, W6, W10); **W17** lateness actions, P1 (L, design needed); **W18** past and today styling, P2 (M, design needed); **W19** fast planner, P3 (L, design needed).

## H. Findings from the watch (to be added after the watch)

Left empty on purpose. The watch writes into `2-schedule-walk-feedback.md`; the orchestrator merges both into the Decide step.
