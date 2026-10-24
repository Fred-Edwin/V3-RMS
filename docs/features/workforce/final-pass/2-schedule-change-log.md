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
| D20 | A **department head may clock someone in** for people in their own department (owner, 24 Oct). Supersedes the Paper note that only the Branch Manager does | Agreed |
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
| Q8 | ~~Does the leave-override reason stay required?~~ | **Decided (owner, 24 Oct): yes, required**; it is a different act from a normal edit |
| Q9 | ~~Should "Counts" be the default for late minutes, with Excuse needing a reason chip?~~ | **Decided: yes** |
| Q10 | ~~Should past columns show what happened (the dots)?~~ | **Decided: yes, as a second step** |
| Q11 | ~~Saved week patterns: per branch, or company-wide too?~~ | **Decided: per branch first** |

P1, P2 and P3 stay proposals until the owner confirms them as a whole; the four answers above settle their open details.

New work items: **W14** cells show timings (S); **W15** optional reason on shift edits, dialog change (S); **W16** retire the closed-by-phone notice and dialog with the shift-end work (part of W5, W6, W10); **W17** lateness actions, P1 (L, design needed); **W18** past and today styling, P2 (M, design needed); **W19** fast planner, P3 (L, design needed).

## J. Corrections confirmed by the owner from the watch (roles 1 and 2, 24 Oct 2026)

The owner agreed with all agent findings below. The references A and B point to the numbered tables in `2-schedule-walk-feedback.md`, which hold the detail. More roles add rows after each "next".

| # | Correction | From | Size | Needs a Paper design? |
|---|---|---|---|---|
| W20 | **Naming sweep:** "Rota" becomes "Shifts" on every screen, button, breadcrumb, print page and notice; menu "My rota" becomes "My shifts"; "Rota · Nyeri Town" becomes "Shifts · Nyeri Town"; heads see "Shifts" or their department's name | A1, B6, B9, B11 | M | no |
| W21 | **"Start from last week" wording** for a new user (what "last week" means, "Left out, need you") | A2, owner D5 | S | no (copy) |
| W22 | Remove **"Arrives with Leave"** (the drawer and the board tile) and the drawer heading "TODAY" on a past day | A3, A9 | S | maybe (what replaces the On leave cell) |
| W23 | **Person label everywhere** (name, position, site; the head reads "Barista · Head", not "Barista") on Home cards, drawers, sign-in line | A4, B4, B7 | M | no |
| W24 | **Home "Needs you" and Latest:** show only what concerns the role (no "Payroll paid" for a head), name the person ("Someone will be on leave" names them); the phone-closed item goes with D19 | A5, B5 | M | no |
| W25 | **Dialog fixes:** Edit time lists clock-in before clock-out, Edit and Remove in the amber underlined style, no "overtime approval" sentence until the new flow exists; the closed-by-phone dialog goes with D19 | A6, A7 | S | no |
| W26 | **Flag an early clock-out** on the Today board (for example "Left 2 h 40 min early, no reason") so it can get an action (ties to P1 and the leave reason chips) | A8 | M | yes, with P1 |
| W27 | Past-day board wording ("expected by 00:00", "ON SHIFT NOW" on a day that ended) | A9 | S | no |
| W28 | **Empty week state:** an unstarted week says "Not started", not "14 thin days"; the legend lists the branch's shifts | A10 | S | no |
| W29 | Footer "thin" count only for the thin department; dates in words ("Wed 28 Oct") in warnings | A11 | S | no |
| W30 | Shift colours match Paper (Afternoon green, Mid-day amber); today marker (part of P2) | A12 | S | no |
| W31 | **Print:** leave days print "Leave", not "off"; "Print the rota" and "WEEKLY ROTA" become Shifts wording | A13 | S | no |
| W32 | Cell picker tells the person is on leave before a shift is chosen | A14 | S | no |
| W33 | "Show retired" count equals the Retired number | A15 | S | no |
| W34 | The Today board top bar gets the bell, like Home | A16 | S | no |
| W35 | Fix the duplicate React key in `sidebar-menu.tsx` (console error on every page) | A17 | S | no |
| W36 | **Heads may clock someone in** (owner decision D20, 24 Oct): the "Clock in for" button stays for a head, for people in their own department. Paper's note ("only the Branch Manager clocks a person in") is superseded; update that Paper note when the Home frames are redrawn. Open: whether a head may clock in for themselves (suggest no, the Branch Manager does that) | B8 | S | no (note only) |
| W37 | **Head pages:** Team today titled for the department ("Barista team today", breadcrumb "Department / Team today"); head's Shifts hides the one-row department list and "Start from last week" unless wanted | B8, B9 | S | no |
| W38 | **One definition of "on shift"** on My team, Team today, Home and Organisation (rostered, clocked in, not started) | B10 | M | no |
| W39 | **Phone Shifts view:** one back arrow, "Needs 2 · Has 4", today marked in the day strip, timings in cells | B11, D17 | S | no |
| W40 | "Not available" text names the right roles per page (no Accountant on Shifts; heads for the grid) | B12 | S | no |
| W41 | Head Home, staff Home, clock card and This week card redesign | B1 to B3, D1 to D4 | L | yes (W1 to W4) |

**Regression guard, keep as it works today (verified by the watch):** Today board numbers and department rows; "Clock in for" dialog (first name, required reason, muted button, nothing saved on Cancel); Edit time preview, reason and See history; leave warning dialog with "they" and a required reason; the next-two-days reason dialog (becomes optional, D18); "Keep editing" saves nothing; Start from last week preview with clashes; shift types table (search, chips, pager); a head sees only their department; My team shows no pay or IDs; "Write report" in amber underline; the phone day view's tap targets; the "Not available for your role" screen; no "he" or "she" in the product text. Builders must not lose these.

## H. Findings from the watch (merged into section J after each role)

Left empty on purpose. The watch writes into `2-schedule-walk-feedback.md`; the orchestrator merges both into the Decide step.
