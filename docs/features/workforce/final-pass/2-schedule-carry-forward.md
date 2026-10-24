# Workforce final pass, section 2: Schedule (Shifts and Attendance), carry-forward list

Written 24 Oct 2026 by the orient session (step 1 of the flow). **Everything here is a prediction** from the approved Paper frames, the module READMEs, the decision files and the People conventions. Nothing was run or watched yet; the owner's walk (step 2) confirms or drops each row. "Size": S under an hour, M a session half, L a full session or more.

## What was read
- Paper file "Wendo RMS · Approved designs", page "Workforce · B. Schedule and time" (page root `root_node_p-B-0`). Frames, one screenshot each: cover `14TB-0`; Chapter 5 steps 1 to 10 `14US-0`, `16KB-0`, `16W2-0`, `177T-0`, `17JK-0`, `17YS-0`, `18DM-0`, `18L6-0`, `18ZT-0`, `19JG-0`; Chapter 6 steps 1 to 6 `19CN-0`, `19E5-0`, `19F8-0`, `19G8-0`, `19HA-0`, `19I2-0`; Shared Notifications steps 1 to 3 `19Q3-0`, `19RW-0`, `19T5-0`; Chapter 7 steps 1 to 6 `1A03-0`, `1AEY-0`, `1AMM-0`, `1AUA-0`, `1B1Y-0`, `1BDP-0`. Chapter 9 (My time, Report a problem, node `1CG5-0`) belongs to section 3 and was not read.
- READMEs and decisions: backend and frontend `rota` and `attendance`; `decisions-2-rota-backend/frontend.md`; `decisions-3-attendance-backend/frontend.md`; `final-pass/LESSONS.md`, `SECTION_FLOW.md`, `design-notes-1-round-1/2/3.md`, the cross-cutting table in `1-people-findings.md`. `1-people-closed.md` does not exist yet (the People close-out is still running), so conventions come from the three design-notes files.
- A few lines of code were checked to confirm what the screens say today (`rota-screen.tsx`, `nav-menu.test.ts`, `file-model.ts`, `board-view.ts`, `person-drawer.tsx`).

## A. What the People conventions change here (predicted)

| # | Where (screen) | What must change | Why (which People rule or decision) | Size | Needs a Paper design? |
|---|---|---|---|---|---|
| 1 | Shifts grid, page title, breadcrumb, phone title (`rota-screen.tsx` says "Schedule / Rota", title "Rota · Nyeri Town", phone "Rota") | Call it **Shifts** everywhere: "Time / Shifts" or the feature breadcrumb, title "Shifts · Nyeri Town", phone title, print heading, notifications ("Your rota is ready" becomes "Your shifts for 12 to 18 October are ready") | Naming table, round 1: "Schedule, Department Shifts, Rota" all become **Shifts**; the menu already says Shifts (`nav-menu.test.ts`) but the screens do not | S | no (a word change; Paper's chapter still says Rota and loses to the naming table) |
| 2 | Shift templates page (breadcrumb "Schedule / Shift templates") | Breadcrumb and menu place: under Time, sub-link of Shifts or its own row; decide how the menu reaches it now that the old "Schedule / Rota / Shift templates" rail is gone | Group 2 menu: Time holds Shifts, Today board, Timesheets, Leave, Casual pay; no Schedule group | S | yes, one small decision (is "Shift templates" a link or a button on Shifts?) |
| 3 | Every person picker and list (Add person to a week, department head list, Today board rows and drawer, Clock in for someone, Edit time, "Everyone today") | Use the **person label**: name, "position · site"; one line in tables ("Name · position · site", site cut first). Today rows show a department but not position or site | Round 2 group 1, frame 7.5 | M | no (rule drawn once) |
| 4 | Every "Edit" on these screens (Shift templates row Edit, Shifts "Edit shifts →", Edit time) | Plain amber underlined **Edit** text (`#A8680A`, 14 px) on the row or card; no boxed Edit button. "Add shift" and "Start from last week" stay page-level actions | Round 2 Edit rule; findings table "Edit convention" | S | no |
| 5 | Shifts phone view (head), My shifts, the clock card (Chapter 6) | Phone standard: 44 px taps, top bar with menu and bell, greeting, the Home kit; Paper's Ch 6 phones are drawn before that standard (Ch 6 uses its own dark header and a hamburger without a bell) | Round 1 group 1: frames 1.9 to 1.11 are the standard for all future phone screens | M | yes, a check: does the Ch 6 clock card keep its dark band inside the new Home kit? Paper must say |
| 6 | Every screen: loading, empty, busy, error | Use the **states kit** ("Nothing needs you", "The system is busy", "We could not load this" with reference and Try again). The README says the Shifts and Attendance screens built "the States kit", but copy and the reference code need a check against 1.13 | Round 1 frame 1.13 | S | no |
| 7 | Blocked addresses (a Branch Manager opening another branch's Shifts, a staff member opening the Today board, a head opening Shift templates, the Director opening the switch) | The **"Not available for your role"** screen with who the page is for and where to go, not a silent redirect or a bare 403 | Round 2 group 4, frames 10.1 and 10.2 | S | no |
| 8 | Breadcrumb of Shifts, Today board, the switch screen | Rule: feature Overviews read "Workforce / Overview" (head: "Department / Overview"); inner pages read feature then page ("Time / Shifts", "Time / Today board") | Round 1 group 1 breadcrumb rule | S | no |
| 9 | Notifications: the shift-change notice, "your shifts are ready", auto-closed shift, clock-in recorded by someone, clock fixed | Bell with unread count and the **"Latest"** list on Home; one template (area and kind, when, title, who and why, one action). Paper's Shared chapter draws a phone **Inbox** page; the final pass says **no Inbox in Workforce** | Round 1 "Left out: any Inbox"; findings table "No Inbox in Workforce" | M | yes: step 1 of Shared Notifications shows an Inbox; the owner should confirm the bell and Latest replace it, and "Mark all read" lives in the bell panel |
| 10 | Today board link: the menu and every Home | "Today board" row for HR, Director, System Admin; head sees "Team today"; Branch Manager and Store Manager reach it from their Home ("See everyone today"). Check this still matches round 1 frames for each role's menu | `decisions-3-attendance-frontend.md` 5; Group 2 menu | S | no |
| 11 | "Team today" counts and Home cards for Branch Manager, head, HR | **One definition** of "on shift", "late", "not in", "on leave" (board-view.ts) and of "active" and "no head" (People Organisation); the Home, Today page and Organisation must show the same numbers for the same branch | `LESSONS.md` "define a number once" | M | no |
| 12 | Employee file, tab **Time** (greyed in `file-model.ts`: `{ value: 'time', disabled: true }`) | Make it live: a person's real attendance (the day view F1, lateness L1, the clock events, links to fix time for those who may). Leave tab stays for section 7 | Findings table "greyed tabs"; the backend already has F1 and L1 | L | yes: no frame draws the Time tab content |
| 13 | Copy "arrives with Leave" in the Today board (`board-view.ts`: "arrives with Leave"; `person-drawer.tsx`: "Arrives with Leave"), and any "slice" wording | Remove. Until Leave exists show "0" or hide the cell, never "arrives with"; a decision for the owner | Copy rule: no "arrives with", no "slice" | S | maybe (what replaces the On leave cell until section 7) |
| 14 | Pronouns in Paper wording the build must not copy: "He asked to work", "Roster him anyway", "Clock in for her", "Wait, she has told me", "Her shift started...", "Mark and HR are told" | Names, "they", role. The built text already says "they" and first names; verify nothing was missed in notices, drawer and printed page | Round 2: no he, she, her, his | S | no |
| 15 | Anywhere a person is shown by a bare name ("Mark Njoroge", "Amina") | Name plus role, or name plus position and site, never a bare name | Brief; round 2 label | S | no |
| 16 | Printed shifts page | Heading "Shifts"; the footer says who printed and when and never "signed"; signature shows first and second name only. Keep the Paper reference style or the week-made reference ("ROT-261019") | `decisions-2-rota-frontend.md` 12, 32 | S | no |
| 17 | Sidebar attention marks on Shifts and Today board | Amber dot and small number for waiting items (round 2 rule), no boxed count. Paper's Chapter 5 and 7 frames still show the old brown boxed "3" on Timesheets | Round 2 sidebar attention marks | S | no |
| 18 | Menu and sign-in around these screens | Verify the old "Schedule" group, "My shifts" (legacy) and the legacy phone bottom tabs for floor staff do not appear beside the new links once the branch is on | Findings table "old HR menu group beside new menu" (section 10) | S | no |

## B. What is missing from the design (screens or states no chapter drew)

| # | Missing | Why it matters | Needs a Paper design? |
|---|---|---|---|
| M1 | **The switch screen** (`/app/workforce/attendance/switch`): branches, on or off, the "what changes" confirm, the refusal when someone is clocked in on the old clock, the "notMirrored" list when switching back | Built without a frame; the System Admin is the only role who uses it | yes |
| M2 | **A refused clock** on the phone: outside the branch (location), not rostered today, clock not open yet (opens 15 minutes before), shift already done, a clock that is already in | The server has 9 refusal codes; Chapter 6 draws none of them | yes, one frame of words and states |
| M3 | **An offline tap, wrong phone clock and "Saved but not sent"** failure (the browser refuses storage) | Chapter 6 step 5 draws only the happy offline note | yes, short |
| M4 | **A phone-closed shift** from the person's side after Chapter 7 changes: the "I worked longer" button has no action (slice 4 not built), so the screen says "ask your manager" | Dead end for the staff member | yes |
| M5 | **The Today board for a branch whose clock is off**, and the Home cards when the switch is off | The README says "nothing shows"; no "why not" state | yes, one state |
| M6 | **Shifts: the empty week**, a branch with no templates, a person on loan, "sent to another site" and "not on the rota" (a Branch Manager or HR person) | Chapter 5 draws only a full week | partly |
| M7 | **Two shifts in one day** and the "+1" cell, plus "Another time, just this once" (Paper step 2 draws it; the build left it out) | Paper and build disagree; Paper wins unless the owner drops it | yes (decision) |
| M8 | **The Today board on a past day and on a phone** (Branch Manager phone Home shows an empty board per round 1) | Branch Manager phone Home is not drawn | yes |
| M9 | **"Mark absent today"** (drawn, not built: no endpoint) and **"Wait, she has told me"** (hides for 30 minutes on one screen, saves nothing) | A drawn button that does nothing or nothing built | decision |
| M10 | **Clocked out by mistake: request and answer** (Chapter 6 step 4 right, Chapter 7 step 4): dialog exists as Edit time; the request itself is section 3 | Staff cannot ask; the Needs you card "Clock-out fix" has no source | section 3 |
| M11 | **Acting as another user** over the clock and Today board | Section 9 | later |
| M12 | **A person's own "My time" page** where a manager's clock-in for them can be disputed (the Paper wording says "Dispute it in My time") | Section 3 (Chapter 9) | later |

## C. Known gaps to carry (not new designs; each needs an owner decision or a back-end job)

| # | Gap | Source | What to do |
|---|---|---|---|
| K1 | Shift change notices are batched **in memory** for 5 minutes; a server restart loses a waiting notice (the shifts themselves are safe) | `decisions-2-rota-backend.md` R6 | Move to the queue or accept; decide before production |
| K2 | The attendance **auto-close and sweep jobs need the worker** running in production (`jobs/workers.ts`, `attendance-auto-close-job.ts`); with no worker an unanswered shift never closes | `decisions-3-attendance-backend.md` A6 | Add to the deployment check |
| K3 | The **legacy lateness report is wrong on a UTC server** (a 06:20 clock-in for a 06:00 shift reads "PRESENT, 0 min" in production); a fix branch for the two legacy functions exists as a recommendation | Attendance decisions, "Finding" | Fix the legacy functions or retire the old figures; **tell Branch Managers the old HR attendance figures will change** when the pilot branch switches |
| K4 | **The legacy clock bridge**: switching on carries today's finished old records; switching off writes today's new clocks back as old records and lists people whose shift exists only in the new shifts (`notMirrored`) | README, A2, A3 | Watch it live on the demo branches; define what the owner tells the branch on switch day |
| K5 | Change notices and "told" lines are only logged until the Notifications module exists ("logs until Notifications exist") | `rota/changes/change-notifier` | Confirm in section 9 that real notices reach the bell |
| K6 | Pay-period lock: `setPeriodClosedCheck` is a hook, no period is ever closed until Timesheets (section 3) | A17 | Check "period closes" copy in Edit time does not show a made-up date |
| K7 | Leave plug-in (`registerLeaveLookup`) returns nothing until section 7: the leave warning and override dialog and the "On leave today" count cannot appear | R4, A14 | The demo data must fake approved leave only through the real lookup, or the leave frames are not walkable yet |
| K8 | "Hours last week" (Paper "last week 208 h") and per-site "needs a look" status are left out | `decisions-2-rota-frontend.md` 8, 9, 27 | Back-end fields, size M |
| K9 | Standing pattern endpoint has no screen (button removed) | Rota decisions R15 | Dead API; delete or keep |
| K10 | Only five of six shift colours can be picked (ROSE exists on the server) | Frontend decision 3 | Add a swatch or retire ROSE |
| K11 | Attendance switch is **on for the two demo branches** in this lane; the method file says never leave a lane switch on in other lanes | brief, `workforce-two-part-method.md` | Leave it on here only |

## D. Coverage list for the watch (one row per screen, role, state)

Roles: **BM** Branch Manager (Nyeri Town), **Head** department head, **Staff** staff member on a phone (390 px), **HR**, **Dir** Director, **SA** System Admin, **Refused** one role that must be refused (a Store Attendant or the Accountant on a manager screen).

| # | Screen / state | BM | Head | Staff | HR | Dir | SA | Refused |
|---|---|---|---|---|---|---|---|---|
| 1 | Shifts grid, current week, department list, four numbers | yes | own departments | | all sites list | read only | sees, edits | not available |
| 2 | Set one shift (picker), clear, day off, drag-fill, keyboard letters | yes | on phone | | yes | no buttons | yes | |
| 3 | Start from last week: preview, clashes, copy; "nothing to copy" | yes | | | yes | no button | | |
| 4 | Today or tomorrow change: reason dialog, "who is told" | yes | phone | | yes | | | |
| 5 | Leave warning and override (needs leave data) | yes | | | | | | |
| 6 | Warnings: thin cover, over contract hours, double shift, "Needs a look" | yes | | | | | | |
| 7 | Past day read-only and a past-day refusal | yes | | | | | | |
| 8 | Copy day dialog | yes | | | yes | | | |
| 9 | Shift templates: list, search, chips, add, edit, retire, restore, company-wide vs site | yes | no link | | company-wide | yes | yes | not available |
| 10 | Print: landscape page | yes | | | yes | | | |
| 11 | Head's phone day view: pick day, pick person, pick shift | | yes | | | | | |
| 12 | My shifts (own upcoming) | | yes | yes | yes | | | |
| 13 | Clock card: before shift, clock in, on shift, undo (two minutes), heads-up, clock out | | yes | yes | | | | |
| 14 | Shift-end prompt: finish, stay on with reason and estimate, leftovers (waiter, barista, attendant) | | | yes | | | | |
| 15 | Leaving early with reason; refused clock states (M2); no signal (M3) | | | yes | | | | |
| 16 | Phone-closed shift: notice to the person | | | yes | | | | |
| 17 | Today board: numbers, Needs a look, departments, past day, branch chooser | yes | own team ("Team today") | | all | read only | yes | not available |
| 18 | Person drawer, clock in for someone (time and reason) | yes | head sees only | | read | | yes | |
| 19 | Edit time: edit, add, remove, preview, history, reason, own-time refusal | yes | no button | | yes (closed periods too) | no | yes | |
| 20 | Phone-closed shift: set the real finish | yes | | | yes | | | |
| 21 | Lateness in the drawer and a person's day | yes | own team | | yes | yes | | |
| 22 | Switch screen: on, off, refused with open clock | | | | | no (owner, 18 Oct) | yes | not available |
| 23 | Homes and menu rows for this role, bell and Latest | yes | yes | yes | yes | yes | yes | |
| 24 | Employee file, Time tab | | | | yes | yes | | |
| 25 | Blocked addresses ("Not available for your role") | | yes | yes | | | | yes |

## F. Owner feedback after reading part A (24 Oct 2026, in the owner's words, then my reading)

| # | Owner said | My reading | Size | Needs a Paper design? |
|---|---|---|---|---|
| F1 | "The copy from last week needs to be improved." | The "Start from last week" dialog (Ch 5 step 3): its wording and what it shows need a better design. Owner clarified: for a new user "Start from last week" does not make sense as worded; only the text needs to be clearer and more intuitive, a small change, not a redesign. | S | no (copy only; Paper frame 03 gets the new words) |
| F2 | "Redesign the department head's homepage, containing many different elements and reflecting all aspects of their role." | A new head Home (desktop and phone) covering their own clock and week, their team today (who is in, late, not in), their team's shifts, probation reports, requests and notices, and requisitions. This replaces the round 1 frames 1.6 and 1.10 for heads. The exact list of elements is for the design step. | L | yes |
| F3 | "Redesign the homepage for staff members who are not department heads." | A new staff Home (desktop and phone): clock, this week, notices, my file, my leave, my payslips. Replaces frames 1.7 and 1.11 for staff. | L | yes |
| F4 | "The large clock where they clock in and out takes too much vertical space." | Shrink the Chapter 6 clock card (the big 00:12:00 timer and the progress bar) so the rest of Home is visible without scrolling. Applies to heads and staff. | M | yes |
| F5 | "Redesign the This week card." | The grey bars card under the clock (Ch 6 step 1) needs a new design. | S to M | yes |
| F6 | "Any improvement to ensure excellent designs." | Open permission to improve the designs I find weak while redrawing. Paper stays the source: every change is drawn and approved before building. | n/a | yes |

These six go to the Decide step as one design group ("Staff and head Home, clock card, This week, Start from last week"). Rows 5 and 12 above (phone standard, Time tab) fold into F2 to F4. Nothing was drawn or changed in this session.

**The shift-end redesign** (automatic clock-out, hand-over, pre-approved overtime, unaccounted orders) is written up in `2-schedule-change-log.md`, which is the hand-off file for the orchestrator.

## E. Where predicted problems are most likely (to watch first)
1. The word **Rota** still on screens (row 1).
2. The **Time tab** still greyed or empty (row 12).
3. **"Arrives with Leave"** on the board and drawer (row 13).
4. Counts that disagree between Home, Today page and Organisation (row 11).
5. A refusal or old-clock state with no words (M2, M5).
