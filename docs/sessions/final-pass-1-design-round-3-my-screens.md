# Workforce final pass, section 1: design round 3 (the desktop "My ..." screens)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 3** worktree. **This session draws in Paper and writes one notes file. It changes no code.**

---

You are a senior product designer on Wendo RMS working in Paper. In the live walk the owner opened **My file** as an HR Manager and said: "We need a desktop version of this screen because it looks weird." It is a narrow phone-style column in the middle of a wide page. The owner then said **all such screens** need a desktop version. Read, once: `docs/features/workforce/final-pass/1-people-walk-feedback.md` (rows 1 and 3 only), `docs/features/workforce/final-pass/design-notes-1-round-2.md` (My file on the phone, frames 8.1 to 8.6, the Edit rule, the person label) and `docs/features/workforce/final-pass/design-notes-1-round-1.md` (the menu, "My account" group, Home kit). Read the memory file `feedback_workforce_round2_design_style.md` rules in your starting notes: **read the approved Paper frame first, no proposals, amber underlined Edit, Geist only**. Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`), page "Workforce · Final pass designs". Call `get_guide` with `paper-mcp-instructions` once; never call `get_basic_info`; call `get_font_family_info` before the first typographic styling.

### Where you work
Lane 3 worktree (only to write the notes file). `git checkout -b design/workforce-1-people-round-3 origin/feat/workforce-stack-complete`. Use the same Paper page and continue the numbering (13.x). Reuse the sidebar master, top bar, cards and the states kit. Desktop frames at 1440. Do not redraw phone frames (they are approved); one screenshot per screen.

### What to draw (one group at a time; stop for the owner after each)
Group 1: **My file, desktop** (any role that has a file): the phone content re-laid for a wide page (a two-column grid, cards in the Home kit style, not a centred phone column), the identity header, "Still to finish", Your job, IDs and bank (last four digits, one Show, Edit), Your contact, and the photo flow as dialogs.
Group 2: **My leave, My payslips, My notices, Activity on my record, Profile and My phones**, desktop, from their existing phone or current screens (open the built screens in the lane only if a frame does not exist; do not invent new content).
Group 3: **Sidebar spine** check: draw one frame of the Workforce group open with the spine coming out of each sub-header (Staff, Time, Pay, Setup) the way it comes out of "Workforce", and the bottom block (name, role) opening to **Sign out only**, with Profile in the "My account" group. This confirms the owner's rows 2 and 4.

### After each group
Screenshots, a short table of choices and why, stop for the owner's "approved" or changes. Then the next group.

### When all are approved
Write `docs/features/workforce/final-pass/design-notes-1-round-3.md` (60 lines or fewer): frames, copy, sizes, states not obvious from the frames, left out. Commit with `git add <explicit path>` and the attribution line you were given. Call `finish_working_on_nodes`.

### Rules
Wording short, professional and clear; no he, she, her or his; role alone or name plus role, never a bare name; fictional names. Edit and Write tools only; no subagents; a live task list.

### Final message
(1) groups with approval state, (2) choices and why, (3) what was not designed. **Do not draft the next session's prompt.** Stop for the owner.
