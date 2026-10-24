# Workforce final pass, section 2, vertical V3 (design stage): lateness actions

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 2** worktree. **This session draws in Paper, then writes the design-notes file and the hand-off. It changes no code.** V3 then continues in this same lane: back end, then front end (each stage started from the hand-off). V2 design runs in lane 4 at the same time on different screens (the Shifts grid); do not draw or edit anything on its Paper page.

---

You are a senior product designer on Wendo RMS working in Paper. Read, once: `docs/features/workforce/FINAL_PASS_HANDOFF.md` (sections 1 and 2), `docs/features/workforce/final-pass/2-schedule-plan.md` (the vertical protocol; V3 is yours) and `docs/features/workforce/final-pass/2-schedule-scope.md` (group E, and M9). **Rule from the owner: always start by reading the currently approved designs before drawing or improving anything**: read `final-pass/design-notes-1-round-1.md`, `-round-2.md`, `-round-3.md`, **`final-pass/design-notes-2-v1.md`** (approved: the Time tab with its marked slot for these actions, and the Today board states) and look at the approved frames they name, the Paper page "Workforce · Schedule · V1" and the approved Today board and timesheet frames (Paper page "Workforce · B. Schedule and time"). Call `get_guide` with `paper-mcp-instructions` once; **never `get_basic_info`**; call `get_font_family_info` before the first typographic styling; one screenshot per frame. Look up detail with `grep -n "^| W17 "` in `final-pass/2-schedule-change-log.md`. Rules from memory: read the approved frame first, amber underlined Edit, Geist only, no proposals for what the owner already decided.

### Where you work
Lane 2 worktree (only to write the notes and hand-off). `git fetch -q origin && git checkout -q -b design/workforce-2-v3 origin/feat/workforce-stack-complete`. Create **a new Paper page "Workforce · Schedule · V3"** in the file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`); do not edit approved chapters or the V1 or V2 pages. Reuse the sidebar master, top bar, board rows, drawer, dialogs, chips and the states kit by duplicating. Desktop at 1440; phone at 390 only where a role uses a phone for this (check the access table). Never draw a phone status bar. Fictional names only.

### Owner decisions (24 Oct)
**Nothing is ever deducted automatically.** Each late person on the Today board, and each late day on the person's Time tab and the timesheet, gets actions: **Excuse** (with a reason), **Counts** (the default), **Make up the time**, a **"3rd late in 30 days"** button that starts a Conduct note by hand, and **Clock in for them** (V1 wording). **"Mark absent today"** (reason: leave, sick, unpaid or no reason) and **"Wait, they have told me"** are kept and built. An early clock-out is flagged on the board ("Left 2 h 40 min early, no reason") and can get an action (W26). "Late" reads one way everywhere: "Late in the last 30 days" includes today (W52). The person is told what was decided. Reasons: only Excuse and Mark absent ask for one.

### What to draw (one group at a time; stop for the owner after each)
**Group 1: The Today board.** The actions on a late row and on a not-in row (where the buttons sit, the drawer, the confirmation in the "who is told" style); Excuse, Counts, Make up the time, Wait, Mark absent today with their dialogs; the early clock-out flag and its actions; the states after an action (a decided row, Waiting with its timer note, an undo if any); loading, busy and error from the kit.
**Group 2: The Time tab and the timesheet.** The same actions on a late day in V1's marked slot, how a decision shows on the day row and in the month figures (late days and minutes, what "Counts" and "Excused" do to the figures), the "3rd late in 30 days" button and its Conduct hand-off, and what the person sees in their own notice.
**Group 3: Make up the time.** How a manager records it, how it shows against the lateness, what happens when it is not made up (nothing is deducted; it stays visible).

### After each group
One screenshot per screen, a short table of choices and why, any wording you invented, and stop for the owner's "approved" or changes. Do not start the next group until the owner says approved.

### When all groups are approved
Write `docs/features/workforce/final-pass/design-notes-2-v3.md` (60 lines or fewer plus tables): frame names, exact copy, states; **what the back end must supply** (decisions per late day, make-up time, mark absent, wait, early clock-out flag, the 30-day count and the Conduct hand-off, notices, audit, access through `requireCapability`); what is left out; what the owner decided. Then write **`docs/features/workforce/handoff-2-v3-design.md`** (60 lines or fewer, the fixed shape in `2-schedule-plan.md`) and print the **starter prompt for the back-end stage in a code block** (begins with `git fetch -q origin` and the branch `design/workforce-2-v3`; reads the hand-off, design notes, `2-schedule-plan.md`, `TESTING.md`; back-end stage only; its own clean test database `wendo_rms_lane2` as `TESTING.md` names it). Commit both files with `git add <explicit paths>` and the attribution line, call `finish_working_on_nodes`, and tell the owner: "The design stage is done. Clear the context, then paste this prompt."

### Rules
No he, she, her or his; role alone or name plus role, never a bare name; one definition of any number. Edit and Write tools only; a live task list; no subagents. If Paper tools are not connected, say so at once and stop.

### Final message (at the end of the design stage)
(1) groups with approval state, (2) choices and why, (3) what was not designed, (4) the starter prompt in a code block. **Do not start the back end.** Stop for the owner.
