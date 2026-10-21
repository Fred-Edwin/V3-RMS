# Workforce final pass, section 1: the design pass (Paper), round 1

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 3** worktree. **This session draws in Paper and writes one notes file. It changes no code.**

---

You are a senior product designer on Wendo RMS working in Paper. The owner reviewed the People section and asked for three things to be redrawn **before** any code is written, because they appear in every role and every later section. Read, once: `docs/features/workforce/final-pass/1-people-findings.md` (only the findings and blocks named per group below, found with `grep -n "^| 30 "` style searches and the sections "Menu proposal", "Navigation naming convention", "Owner decisions and conventions"), `docs/DESIGN_SYSTEM.md` (tokens and rules), `docs/UI_BUILD_RULES.md` (§4a table convention) and `docs/features/workforce/final-pass/1-people-decisions.md` (what is in the design pass). Paper first: call `get_guide` with `paper-mcp-instructions` once; **never `get_basic_info`**; call `get_font_family_info` before the first typographic styling.

### Where you work
Lane 3 worktree (only to write the notes file). `git checkout -b design/workforce-1-people-round-1 origin/feat/workforce-stack-complete`. Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`). Create a **new page "Workforce · Final pass designs"**; do not edit the approved chapters. Reuse the approved kit (sidebar master, top bar, cards, table, chips, the states kit) by duplicating from "Workforce · A. The people". Desktop frames at 1440 and phone frames at 390; never draw a phone status bar; one screenshot per screen.

### The three groups (one at a time; stop for the owner after each)
**Group 1: a Workforce Home for every role** (findings 18, 26, 30, 31, 35, 38, 39, 45, 51, 58, 60, 73, 76). Roles: HR, Director, Accountant, Branch Manager, Store Manager, department head, staff, System Admin. One card kit: KPI cards (suggested set in finding 30; a Director set, an Accountant "Blocks payroll" set), a paged **"Needs you"** table in the style of the System Admin's (Kind, Request, Where you decide, Since; top 5 by urgency, grouped with counts, "See all N" opening a paged, filterable list per the table convention; overdue probation first), a short **"Latest"** notifications list, and a bell with an unread count in the top bar. No Inbox in Workforce. Every role lands on its Home after sign-in. Desktop for every role; phone for the Branch Manager, department head and staff. Show the empty, loading and error states once with the shared kit, not per screen.

**Group 2: the menu** (findings 9, 41, 74 and the two proposals). Organised by feature (People, Time, Pay, Operations, Inventory, Reports, Company settings), the same names for every role, each role sees only its modules, at most 8 modules; only the active module is open; the curved connector rail for sub-links; collapsed modules show the sum of their badges; personal items (My file, My payslips, My leave, Profile) in the account block; a jump box (also Ctrl+K); "Home" is always "Home", the schedule is "Shifts", a food menu is "Menu items". Draw it for the Director (the longest), HR, a department head and a Store Attendant on the phone drawer. Add a one-page **naming table** (every link, its new name, its module) as text in the notes file.

**Group 3: the "Is this your phone?" step** (findings 13, 72). One responsive design for the first-time device step only: desktop 1440 and phone 390. A clear heading that says "this computer" or "this phone" to match, the device shown as "Chrome on Linux" or "Android phone", place and time, why the check matters in one line, "Yes, trust it" and "Use it just once". **The "Welcome back" login is not to be redrawn or touched.**

### After each group
Take one screenshot per screen, show them to the owner and stop with: what you drew, the choices you made (a table: choice, why), and any wording you invented. Apply the owner's changes to that group only, then move on. Do not start the next group until the owner says "approved".

### When all three are approved
Write `docs/features/workforce/final-pass/design-notes-1-round-1.md` (60 lines or fewer plus the naming table): per group, the Paper frame names, the exact copy, the sizes and states that are not obvious from the frames, and what is deliberately left out. Commit it with `git add <explicit path>` and the attribution line you were given. Call `finish_working_on_nodes` when you finish drawing.

### Rules
Paper is a demonstration and production is the goal: design what ships. Wording is short, professional and clear (chips and card labels up to 3 words, buttons start with a verb, no developer words); no he, she, her or his; role alone or name plus role, never a bare name; a person is shown as name, position and site. Fictional names only in sample data. Edit and Write tools only; no subagents; a live task list.

### Final message
(1) the groups with their approval state, (2) a table of choices and why, (3) what was not designed (the second design round: Edit button and person label, My file on the phone, the department head's probation card, the refusal screen, Act as). **Do not draft the next session's prompt.** Stop for the owner.
