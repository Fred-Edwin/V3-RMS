# Workforce final pass, section 1: design round 2, handoff

Working document. Delete it when Workforce ships. Written 21 Oct 2026 at the end of design round 1 (lane 3). A fresh session in the **lane 3 worktree** reads this file, then continues. **This session draws in Paper and writes a notes file. It changes no code.**

## 1. Where things stand
- Branch `design/workforce-1-people-round-1` (pushed). Continue on it, or branch `design/workforce-1-people-round-2` from it.
- Paper file "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Page "Workforce · Final pass designs", page id `p-R-0`. **Do not edit the approved chapters on other pages.**
- Round 1 is drawn and owner-approved: role Homes (frames 1.1 to 1.13), the menu (2.1 to 2.7, 2.3b), the sign-in family (3.1, 3.2, 4.1 to 4.5), the Act as sketch (6.1 to 6.5). Everything is described in `docs/features/workforce/final-pass/design-notes-1-round-1.md` (read it first, it is short).
- Findings and decisions: `docs/features/workforce/final-pass/1-people-findings.md` (grep `^| 33 ` style for a row), `1-people-decisions.md`, and `docs/features/workforce/FINAL_PASS.md`.

## 2. What is left (design round 2)
Draw each, one group at a time, **discuss first**, stop for the owner after each group:
1. **Edit button and person label** (findings 32, 33): one shared person label "Name · position · site" used in every picker and list; an "Edit" button at the top right of every card whose data the role may change (Job already has it). Draw the Job and pay tab with Edit on Job, IDs and bank (dialog: National ID, KRA PIN, NSSF, SHA, HELB, bank, account; reason asked for bank changes; tells the Accountant), and Pay ("Change pay" also appears on the Pay card; amounts are dated changes the Director approves, never edited in place); read-only cards say who may edit ("HR only"). Also the Director's pay-change review dialog (finding 36): Now, New, Difference (amount and %), position and site, any other dated change, overlap warning, PIN (Q1 yes: pay changes ask for a PIN).
2. **My file on the phone** (findings 15, 61, 67, 68, 70, 64, 65, 66): My file reachable from the account menu for every role; "Head of Kitchen" row for heads; the person can enter their own National ID, bank and account number (Q2 yes, HR verifies); IDs and bank hidden by default (last four digits) with a Show button; every tap target at least 44 px (the Add rows are the full row); "Who looked at your file" list (name, role, day); photo save failure message with the reference. Phone first.
3. **Department head's probation card** (findings 60, 63): the "Report due" row on the head's Home opens a small note dialog (the head writes the probation report; HR's Decide dialog shows "Head's report"); the read-only **My team** list (name, position, today's status, no pay, no IDs). Phone first, desktop second.
4. **The refusal screen** (finding 53, 62): one screen for every blocked page, "Not available for your role" and who it is for, replacing silent redirects. Desktop and phone.
5. **Kitchen, Bar and Service work pages**: today's floor-staff pages stay as they are until their feature is redone (Kitchen head sees Kitchen, Performance, History, Deliveries, Requisitions). Confirm with the owner whether anything needs drawing; default is nothing.
6. Smaller, only if the owner asks: Branch Manager's file layout (47), Act as full design (its own project, a five-screen sketch exists).

## 3. Decisions already made (do not reopen)
- Floor staff (heads, staff) get their own short menus; heads also get a "Department" group (Overview, My team, Shifts, Timesheets). The System Admin does **not** get the Director's People, Time or Pay screens (it acts as users).
- Menu: top link "Home"; each feature opens with "Overview"; Workforce labels Staff, Time, Pay, Setup; "Search" (Ctrl K), never "jump box"; personal items in the account menu at the bottom; no Inbox in Workforce.
- **Accounts are never locked for wrong tries.**
- Cash and M-Pesa stay as payout choices (casuals).
- Sign-in: "Confirm this device", "Trust this device", "Use just this once". Support line "Need help? Call or WhatsApp Fred on +254 113 176 613. Every day, 6 a.m. to 10 p.m." on every sign-in screen. Builder is **Fred**.
- Phone Home screens (frames 1.9 to 1.11) are the **design standard for every phone screen**: top bar with menu and bell, greeting, 2x2 KPI cards, stacked action cards with full-width 44 px buttons, one left edge at 24 px, big gaps between groups and small gaps within.
- Fonts: **Geist and Geist Mono only**. No Fraunces. Wording: chips and card labels up to 3 words, buttons start with a verb, no developer words, no he/she/her/his, a person is "name, position, site". Fictional names only. Paper is direction, production is the goal.

## 4. How the owner wants to work (lessons from round 1)
- **Discuss before you draw.** For every group, post a short proposal and ask your questions (use the question tool with a recommendation), then wait for "proceed". Touching the design before alignment upset the owner twice.
- Do only what was asked; do not change frames the owner did not mention. Say what changed and what did not.
- One screenshot per screen, shown after each group; end each group with: what was drawn, a table of choices (choice, why), and any wording invented. Apply changes to that group only. Do not start the next group until the owner says "approved".
- Paper first, then compare; no automated pixel diff. Never draw a phone status bar. Task list kept live. Edit and Write tools only for files; no subagents. End every task with a short plain recap (what changed, which files, how to verify).
- Deleting artboards: only when the owner says so, after listing them.

## 5. Paper working notes
- Load `get_guide` `paper-mcp-instructions` once; never `get_basic_info`; `get_font_family_info` before typography (Geist is available). Call `finish_working_on_nodes` when done drawing.
- Reuse by `<x-paper-clone node-id="...">` inside `write_html`. Good sources (all on page `p-R-0`): Staff Home phone `3F6K-0`, Department head Home phone `3F3W-0`, Branch Manager Home phone `3F16-0`, HR Home desktop `3CZ8-0`, Director Home `3D8M-0`, Accountant Home `3DHU-0`, Department head Home desktop `3E9I-0`, staff Home `3EIQ-0`, System Admin Home `3ERY-0`, sidebars (admin `3HKV-0`, Director `3HXL-0`, HR `3HP3-0`, head `3GDF-0`, attendant drawer `3GHP-0`), sign-in card screens `3GOZ-0` (3.1), `3GUD-0` (4.3), `3GTA-0` (4.1), phone `3GQ6-0`, `3GY5-0`, `3GY6-0`, states kit `3FJO-0`, Needs you list `3F98-0`.
- `write_html` with `mode: replace` replaces a node; writing full HTML with inline styles is faster than editing many nodes. Frames over 900 px tall: set `height: fit-content` with `update_styles`. Name frames "7.1 · ..." onward so they follow 6.5.
- Tokens: espresso `#693C1B`, caramel `#D9A65E`, ink `#171512`, border `#E4E2DE`, sidebar gradient `#2E1806` to `#0F0601`; radius 2 to 6 px; shadows only on floating things.
- Gradient 3 and grain 35% are the brand panel; do not change.

## 6. When all round-2 groups are approved
Write `docs/features/workforce/final-pass/design-notes-1-round-2.md` (60 lines or fewer plus tables): per group the frame names, exact copy, sizes and states not obvious from frames, and what was left out. Commit with `git add <explicit path>` and the attribution line you were given. Update `docs/features/workforce/FINAL_PASS.md` (People row) and `docs/PROJECT_STATUS.md` (Workforce design row), push the branch, and write a short summary the owner can paste to the orchestrator. Do not draft the next session's prompt.

## 7. Still open from round 1 (mention, do not chase)
- "Real-time visibility" wording must be checked against the product before it ships. The sign-in login code (`frontend/app/(auth)/login/page.tsx`) still has the old layout. No pull request is open.
- The Director's Company group in frame 6.5 shows only Analytics, Audit log and Branches (the full list is in the notes).
