# Workforce final pass, section 2: Schedule, walk feedback

Written during the watch (step 2), lane 4, 24 Oct 2026, Saturday, about 09:00 to 10:00 Nairobi. Part 1 holds the owner's words, role by role. Part 2 holds what the agent saw that the owner did not mention, so the owner can keep or drop each line. The Decision column is left blank for the Decide step.

## Part 1: what the owner said

| # | Role | Where | What the owner said | Your note (what you saw, or "not seen by me") | Decision (blank) |
|---|---|---|---|---|---|
| 1 | Branch Manager | Shifts grid cells | "For the shift schedules sheet that has the cells, we need to go back to using the timings instead of the shift schedule names or the shift names." | Cells show the shift name (Morning, Afternoon). This reverses the owner's decision of 18 Oct 2026 (rota frontend decision 33). Paper's frames already draw timings (06–14). | Agreed: show timings |
| 2 | Branch Manager | Today board, "Closed by the phone at 22:00" | "We're not going to need the closed by phone at 2200 hours notification after the updates to the clock out feature, right?" | Today it shows as a Needs a look row and a dialog (A6). After the new shift-end flow the system clocks people out at the scheduled end, so this notice goes; see the change log, section I. | Retire (to confirm) |
| 3 | Branch Manager | Today board, late staff | "There's a notification for staff who come in late, and we are displaying the amount of time lost due to the lateness. I think we need to have some action that the manager can take, perhaps an action related to the lateness... I think this should be consequential to the timesheets." | Late rows show minutes and a bar only; the only button is for people who are not in. The agent's proposal is in the change log, section I, item P1. | Proposal pending |
| 4 | Branch Manager | Shifts grid, past and future days | "We need to show the disparity between the shifts that have already passed. For example, if today is Saturday, there needs to be a visual difference between the shifts from Saturday onward and the shifts that occurred before Saturday." | Today the grid has no today marker and past days look like future days (A12). Proposal: change log, item P2. | Proposal pending |
| 5 | Branch Manager | Editing a shift, reason | "When editing shifts, the reason should be optional." | A change to today or tomorrow currently needs a reason (rota backend decision R3). This reverses that rule for shift edits. The leave override reason is a different dialog and was not mentioned. | Agreed: optional |
| 6 | Branch Manager | Setting shifts for the branch | "A way for the branch manager to set the shifts for the branch quickly and easily because the current workflow has too many steps, too many tabs... optimize the user flow for creating and setting the shifts, only for setting the shifts so as to enable them to make quick fixes or edit the shifts table as well as create the shifts for the entire branch for an entire week or an entire month." | Setting a week today takes: Shifts, a cell, a shift, repeat for every cell; "Start from last week" copies only the week before; Shift types sits on another page. Proposal: change log, item P3. | Proposal pending |

| 7 | Staff and head screens (all) | Pages across the system | "We need to include some copy in these screens that informs the user of the purpose of the page or how they should use the page. Keep it simple, clear, and intuitive, and ensure it does not mess up the design. But this might span not only these screens but all across the system." | Some pages have a subtitle (Shifts types, My team), most do not. Proposal in the change log, section K (P4). | Proposal pending |
| 8 | Staff member on a phone | All findings C1 to C10 | "I agree with the observations. Let's proceed." | Folded into the change log section J (W42 to W47). | Agreed |

## Part 2: what the agent saw and the owner did not mention

### Role 1: Branch Manager, Nyeri Town (Faith Wambui)

| # | Where | What I saw | Predicted before? |
|---|---|---|---|
| A1 | Shifts grid, breadcrumb, Print page, Shift templates page, Add shift dialog, Start from last week dialog | The word **"Rota"** is still on screen: title "Rota · Nyeri Town", breadcrumb "Schedule / Rota", "Print the rota", "WEEKLY ROTA", "put on a rota", "every rota cell", "Copies the rota for…". The menu already says **Shifts**. | Yes (row 1) |
| A2 | Start from last week dialog (owner's point D5) | "Last week" means the week before the one on screen, not the calendar's last week; "Left out, need you" is unclear; uses "rota" | Owner raised it |
| A3 | Today board, person drawer | Row **"Leave: Arrives with Leave"** in the drawer. On a past day the drawer heading still says **TODAY** | Yes (row 13) |
| A4 | Home "Your team today" | Rows show bare names ("Victor Mutua", "Kelvin Mwai") with no position or site; board rows show position only, no site | Yes (row 3, 15) |
| A5 | Home "Needs you" | The shift the phone closed (Joseph Maina) is on the Today board's "Needs a look" but **not** on the Home "Needs you" list; the design draws it there | Partly (M4) |
| A6 | Shift closed by the phone dialog | Awkward wording ("had no answer for the rule's wait"); even **Keep 22:00** asks for a reason; says overtime is "approved on the timesheet" (the old model; the new flow is approved beforehand, see the change log) | New |
| A7 | Edit time dialog | Events are listed **clock-out first, clock-in second**; **Edit** and **Remove** are plain links, not the amber underlined style; text says "overtime approval" (old model). The preview (recorded against after, 5 h 18 m to 7 h 58 m) and **See history** work well | Partly (row 4) |
| A8 | Today board, Thursday 22 Oct | Mary Njeri clocked out at 11:20 on a 06:00 to 14:00 shift (2 h 40 min early) and shows **Finished**; the board says "Nobody needs a look right now" | New |
| A9 | Today board, past day | "ON SHIFT NOW 0 of 8, expected by 00:00" reads oddly for a day that has ended | New |
| A10 | Shifts, an empty week (2 to 8 Nov) | An unstarted week shouts **"Needs a look 14, 14 thin days"** and every department says "Not started"; the shift legend shows only "Leave" | New |
| A11 | Shifts, next week | Footer says **"16 thin"** for the whole branch on Wednesday although only Barista is thin; the warning prints a raw date ("needs 2 on **2026-10-28**") | New |
| A12 | Shifts grid | **Afternoon is amber and Mid-day is green**, the reverse of the Paper frames; there is no marker for today's column | New |
| A13 | Print page | Cynthia's leave days print as **"off"**, not "Leave" (Paper draws "Leave") | New |
| A14 | Cell picker on a leave day | The picker shows no hint that the person is on leave until a shift is chosen; the leave warning dialog itself is good (names the person, says the leave stays, required reason, says "they", no pronouns) | New |
| A15 | Shift templates | Chip **"Show retired 4"** does not match the **"Retired 0"** number above it | New |
| A16 | Today board | The page top bar has **no bell**; the Home top bar does | New |
| A17 | Console, every page | Error: two sidebar menu children share one key (`sidebar-menu.tsx`, FeatureRow, "history"); harmless today, a risk later | New |
| A18 | Sign-in | On a new device the "Confirm this device" step is shown; after "Trust this device" the PIN step did not appear and the page went straight to the app | Observed |

**Owner's change in the lane data (24 Oct, 09:40 Nairobi):** the audit log holds `rota.cells_changed` by Faith Wambui: Ann Wangui, Saturday 24 Oct, from "Day off" to "Morning", reason "Cover for a gap". The owner confirmed this was their own edit during the browser walkthrough; it is not a fault. It was left as is.

**Owner's confirmation (24 Oct 2026):** the owner agreed with every agent finding in role 1 (A1 to A18) and role 2 (B1 to B12) as things that need correcting. They are folded into `2-schedule-change-log.md`, section J.

**Worked well, no change needed:** the Today board numbers and department rows; "Clock in for Victor" (first name, required reason, button muted until a reason is chosen, nothing saved on Cancel); Edit time preview and history; the leave warning; the reason dialog for a change to tomorrow ("Cynthia is told", "Keep editing" saves nothing); Start from last week preview with clashes (Susan Wafula on approved leave); the shift types table (search, chips, numbered pager, rows per page); no "he" or "she" seen.

**Not covered for this role:** Copy day dialog; drag-fill and keyboard letters on the grid; Add shift saved; Edit and Retire a shift; the printed page's real print; Home phone widths (the Branch Manager has no phone design yet).

### Role 2: Department head, Nyeri Town (Victor Mutua, Barista head)

| # | Where | What I saw | Predicted before? |
|---|---|---|---|
| B1 | Head Home (desktop and phone) | The page is mostly personal: five number cards, the large **clock card** (03:53:23, a full-width Clock in button, about 245 px high on desktop and 370 px on a phone), a "This week" card, then Latest. On the phone the clock sits **below five number cards**, so the head must scroll to reach it | Owner raised (D1 to D4) |
| B2 | Head Home, "This week" card | Seven tiny bars spread across the full page width, mostly empty space; "24 h 0 m so far of 40 h 0 m planned"; days M T W T F S S | Owner raised (D4) |
| B3 | Head Home, what is missing for the head's role | No thin-day warning, no overtime requests, no items needing an owner, no probation report card (only the count "1 report due"), no requisitions, no team shifts for the week | Owner raised (D1) |
| B4 | Head Home, team card | Lists only Victor himself as "Not in", by bare name | Predicted (row 3) |
| B5 | Head Home, Latest | "Payroll paid, The August 2026 payroll was marked as paid" and "Your leave balance changed" show to a head; "Someone in your department will be on leave. **The rota** shows the days" has no name | New |
| B6 | Menu, My account | Rows named **"My rota"**, "My time", "My requests" (the naming table says Shifts); a "Barista" row with 6 waiting beside "Department" | Predicted (row 1) |
| B7 | Sign-in, device step | The head's line reads "Victor Mutua, Barista · Nyeri Town" (no "head") | New |
| B8 | Team today (head) | Page title is **"Today at Nyeri Town"** with breadcrumb "Workforce / Today board" although the menu says "Team today" under "Department"; the head sees **"Clock in for Victor"**, even for himself (Paper's note says only the Branch Manager clocks someone in, because a head decides nothing) | New |
| B9 | Shifts (head) | Title "Rota · Nyeri Town" for a head; a department list with a useless "All departments" row; "Start from last week" offered. No Shift types link (correct) | Partly (row 1) |
| B10 | My team | Counts "On shift 4" and shows Victor (not in) and Lilian (shift not started) as "On shift": "On shift" here means rostered today, not clocked in, so it disagrees with Team today | Predicted (row 11) |
| B11 | Phone Shifts view | Close to Paper step 9. Title "Rota" and "Barista rota"; two back-pointing arrows at the top (back and previous week); shows only "Has 4" with no "needs" number; today not marked apart from the selected day; cell names, not timings | Partly |
| B12 | Blocked address (Shift types) | The "Not available for your role" screen works, with a reference. Its text lists "the Accountant" as a Shifts user (the Accountant sees only their own shifts) and does not mention department heads | Predicted, mostly works |

**Worked well:** the head sees only the Barista team on every page; no pay or IDs shown on My team; "Write report" in amber underline for the probation case; the phone day view's tap targets; the not-available screen.
**Not covered for this role:** a saved shift change by a head; the clock itself (not tapped on purpose); My file, My time, My requests.

### Role 3: Staff member on a phone, 390 px (Naomi Jepkorir, Waiter; Cynthia Muthoni for a day off)

| # | Where | What I saw | Predicted before? |
|---|---|---|---|
| C1 | Staff Home, phone | The first screen is three number cards (Leave days left, Leave asked, New notices, about 380 px); the **clock card starts at the bottom edge** and is about 500 px tall (the shift line, a 100 px timer, a progress bar, a full-width button). A person who opens the phone to clock out has to scroll | Owner raised (D2, D3) |
| C2 | Staff Home, "Leave days left" | Shows **a dash ("–")** for a person with an annual leave policy (also for Cynthia) | New |
| C3 | Staff Home, "This week" card | Works well at 390: seven bars, today outlined, "27 h 59 m so far of 36 h 30 m planned" | Owner raised (D4), phone is acceptable |
| C4 | Staff Home, Latest | "Payroll paid, The August 2026 payroll was marked as paid" shows to every staff member | Same as B5 |
| C5 | Menu drawer | Wide rows and clear sections (good); rows **"My rota"**, "My time", "My requests"; the drawer **stays open** after a row is chosen and covers the page until closed; footer shows "Waiter" with no site | Partly (row 1) |
| C6 | My rota (phone) | Clean: **TODAY** marker, shift name with timings, days off muted. Header reads "MY TIME · ROTA"; days after the last planned day (from Mon 2 Nov) show **"Day off"** though they are just unplanned | New |
| C7 | My time (phone) | Clear: month total, weeks in groups, each day with in and out and hours, today's open shift shown as "06:02 → …". No fault found | Works well |
| C8 | Blocked page (Today board) | Works. It lists "HR, the Director, Branch Managers and Store Managers" and leaves out department heads, who have "Team today" | Same as B12 |
| C9 | A staff member with no shift today (Cynthia) | The Home has **no clock card and no message** (no "No shift today", no "Next shift Monday 06:00"); a refused clock cannot be seen from the phone because there is nothing to tap | New |
| C10 | Sign-in, device step on a phone | Good: "first sign-in on this phone", "Chrome on a phone", short hero; the PIN step did not appear after "Trust this device" (same as A18) | Works well |

**Not seen by me in role 3 (owner chose to skip the wait, 24 Oct):** the 10-minute heads-up, the shift-end question (Finish now, Stay on and its reasons, the list of open items), Clock out and the two-minute Undo, an offline tap. By the design (Paper Chapter 6 steps 1 to 6) and the front-end README these screens exist, but they are replaced by the new shift-end flow in the change log (section B), so they will be walked after the rebuild.

### Sample-data problems the agent caused and fixed during the walk (so the owner knows what was re-seeded)
1. Later shifts (10:00 and 14:00) showed as clocked in at 09:00. Fixed in `schedule.ts`, re-seeded.
2. About 13 people hired by the people flow had no shifts at all (0 hours). They now have a plan like everyone else. Re-seeded again.
Both fixes are committed. The seed was run three times; the live items (late, open shift, shift-end) are timed to the minute of each run.
