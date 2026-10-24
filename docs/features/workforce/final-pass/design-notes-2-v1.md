# Workforce final pass, section 2, V1: design notes (the Time tab and the board states)

Paper file "Wendo RMS · Approved designs", page "Workforce · Schedule · V1". Owner approved both groups on 24 Oct 2026. Geist and Geist Mono only; fictional names. Built on the approved frame 7.1 (employee file), the Today board (Branch Day chapter 7, step 1), the states kit (1.13) and the phone standard (1.9). Read those first.

## Group 1: the Time tab on the employee file (frames 1.1 to 1.5)
| Frame | Shows |
|---|---|
| 1.1 | Time tab for HR, the Director and the Branch Manager (own branch): amber underlined "Edit time" on each day |
| 1.2 | Same tab, read only (the Accountant): no "Edit time", no header buttons, line ends "Read only for your role." |
| 1.3 | Overview tiles "On time", "Overtime", "Leave left" for a person who clocks and one who does not |
| 1.4 | Empty: a person who does not clock; a branch whose clock is off |
| 1.5 | Loading (grey blocks, month picker stays), busy, error (kit copy, reference code) |

**Who sees it.** `timesheet.read`: HR, Director, Accountant, Branch Manager and Store Manager (own unit), System Admin. **Department heads do not**: no `timesheet.read`, and "My team" has no link into a file. `time.fix` (Edit time): HR, Director, Branch Manager. The Accountant reads only.
- Order on the page: tabs (Overview, Job and pay, Time, Leave), month picker (`‹ October 2026 ›`), line "Late in the last 30 days: 3 days, 29 minutes. Includes today.", summary row, filter chips (All days, Late, Overtime, Absent, each with a count), table, pager (numbered, rows per page, per the table kit), a dashed note.
- Summary cells: DAYS WORKED ("of 20 rostered"), HOURS, LATE DAYS ("20 minutes in total"), OVERTIME ("approved"), ABSENT DAYS ("no clock, no leave"). Late and absent figures in red-brown.
- Table columns: DATE (Geist Mono, "SAT 24 OCT"), SHIFT, IN, OUT, HOURS, LATE, OVERTIME, Edit time. Today row is tinted `#FBF3E4` with "On shift" and "so far 4 h 12 m". Day off: one grey line, "Day off". Absent: "Absent" tag, 0 h. Late: "Late 12 min" tag. Overtime: "1 h 25 m approved".
- Dashed note at the bottom (not a feature): "Space kept here for Unaccounted items and the lateness actions. They are drawn and built later." tagged "Not part of this design". V3 and V4 replace it.
- Empty copy: "Faith Njeri · Branch Manager does not clock in" / "Branch Managers are not on the clock, so there are no days to show. Their pay is a fixed amount each month." and "The clock is off at Nyeri Town" / "Clock-ins are not being recorded at this branch, so there are no new days to show. Days from before the clock was switched off stay here. The Director or the System Admin can switch it on."
- Error: "We could not load this", "The time for <name> · <position> did not load. Nothing was changed. Reference WF-xxxx." Busy: "The system is busy".

**Definitions (one each).** *Late in the last 30 days* = days clocked in past the grace time in the 30 days up to and including today. *On time* tile = shifts clocked in within grace, out of shifts worked, same 30 days ("17/20 shifts, last 30 days"). *Late days* (summary) = the same test, but for the month picked. *Overtime* = overtime the Branch Manager approved in the month. *Leave left* shows "Not set" and "No leave rule for this position yet" until the Leave section holds balances; no "arrives with" wording. A person who does not clock shows "Not tracked / Does not clock in" on On time and Overtime.

**The back end must supply**
| Need | Exists? |
|---|---|
| One day for one person (`GET /workforce/attendance/day`: employeeId, date) | Yes |
| Lateness over a range, by site or person (`GET /workforce/attendance/lateness`: from, to, max 62 days) | Yes; use for the 30-day line and tile |
| A person's month: per day shift, IN, OUT, hours, late minutes, absent, overtime approved, day-off, today row; plus the five summary figures; filter and paging | **New** (a month read; calling `/day` 31 times is not allowed) |
| Whether the person clocks and whether the branch clock is on (for the two empty states) | Partly (switch read exists); expose on the month read |
| Overview tile figures (On time, Overtime) | **New** (small read) |
| Edit time | Exists (`POST /fixes`, `/fixes/preview`) |

## Group 2: the Today board's missing states (frames 2.1 to 2.4)
| Frame | Shows |
|---|---|
| 2.1 | Clock off, Branch Manager and HR: tiles On shift, Late, Not in read "Not tracked / clock is off"; On leave today still real. Card with two blocks (WHY YOU SEE NO ONE, WHAT TO DO) and amber links "Open Shifts", "Open Leave" |
| 2.2 | Clock off, Director and System Admin: same, but WHAT TO DO is "Switch the clock on for Nyeri Town. Today's times are copied over and the board fills at once." and a brown button "Open Attendance switch" |
| 2.3 | Past day (Fri 23 Oct), read only: title is the date plus tag "Past day · read only"; line "This day is over. You can read it, and fix a clock time with Edit time."; date picker and amber "Back to today"; tiles WORKED ("rostered, clocked in"), LATE, ABSENT ("due 06:00, never clocked in"), ON LEAVE; list "That day's exceptions" with "Edit time" only (no "Clock in for…"); side panel "Fixed after the day"; By department kept |
| 2.4 | Phone (390), Branch Manager, live day: dark top bar (menu, "Today", site, bell), 2×2 cards (174 px), "Needs a look" as stacked cards, 44 px "Clock in for them", By department rows |

- Wording rules: no "ON SHIFT NOW", no "expected by", no "TODAY" heading on a past day, no "Arrives with Leave". The phone button reads "Clock in for them" (no pronoun); the approved desktop board still says "for her/him": change it when the desktop board is next built.
- The board read already takes `date` (`GET /workforce/attendance/board?siteId&date`); the back end must mark a past day read only and drop the live-only actions. The Branch Manager's phone Home is the same board.
- Sidebar in 2.1 and 2.3 is the HR menu copied for convenience; each role uses its own menu and highlights Overview. Clone glitches are Paper, not design.

## Left out
Time tab phone view (no role uses it on a phone); a Time tab for department heads; Unaccounted items and lateness actions (V3, V4); leave balances (section 7); a clock-off phone frame (same card, stacked).
