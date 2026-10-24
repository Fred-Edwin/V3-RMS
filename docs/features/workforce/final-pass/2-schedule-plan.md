# Schedule: the delivery plan (verticals)

Proposed 24 Oct 2026 for the owner's approval. It sequences the 65 items of `2-schedule-scope.md`. The owner's idea is adopted: **each piece of product work is a vertical**, one terminal and one lane that carries it from design to back end to front end through planned hand-offs, so it is easy to follow. Designs are serial (the owner's approval is the bottleneck); builds run in parallel in different lanes.

## The groups (verticals), in ascending size
| # | Vertical | Scope items | Needs | Sessions | Why this place |
|---|---|---|---|---|---|
| V0 | **Quick fixes** | A (11), B (19), C (6), the purpose-line mechanism (W48, W49) and removing "Mark absent" and "Wait": **38 items** | No design | 1 | The base. Everything else builds on its wording, names and gates, so it merges first. |
| V1 | **The Time tab on the employee file** | W54 (1 item), plus the Today board's "clock is off" and past-day and phone states (M5, M8) | Design, a little back end, front end | 2 (design, then build) | Smallest piece with a design; the back end for it already exists |
| V2 | **The fast planner and past days** | W18, W19 (2 items), K9, the standing pattern API | Design, back end, front end | 3 | Self-contained to the Shifts screens and the rota module |
| V3 | **Lateness actions** | W17, W26, W52 (3 items) | Design, back end, front end | 3 | Touches the Today board and, later, the timesheet |
| V4 | **The shift-end and overtime flow** | W5, W6, W7, W8, W10, W11, W16 (7 items) | Design, a large back end, front end | 3 or 4 (the back end may need two sessions) | The largest; its own group, as you suggested |
| V5 | **The Homes and the clock card** | W1, W2, W3, W4, W41, W45, W50 (7 items) | Design, a small back end (numbers), front end | 3 | Last, because the Homes carry V3's and V4's states (overtime requests, items needing an owner, the ten-minute warning) |
| | Moved to other sections | W9, W46, W55, W58, W60, W65 | | n/a | Section 3, section 9, or decided |
| | Close-out and video | W13 and the rest | | 1 close-out, then the video | Once, for the whole of Schedule |

Total: about **15 sessions**, of which 6 are designs you approve.

## How one vertical runs (the hand-off protocol)
All three stages run in the **same lane and terminal**, with the context cleared between stages. Every stage ends the same way: it commits, writes a hand-off file and prints a starter prompt in a code block.

| Stage | What happens | Ends with | You |
|---|---|---|---|
| **Design** | The agent draws the vertical's screens in Paper, in groups. You approve each group. | A **design-notes file** (the spec the builders read: frames, exact copy, sizes, states, what is left out) and `handoff-<vertical>-design.md` | Approve each group, then clear the context and paste the starter prompt |
| **Back end** | Builds the rules, tests them on a clean database, writes the API and data notes. Reads the design notes for what the screens will need. | `handoff-<vertical>-backend.md` (what was built, the API, gotchas, what the front end must call) and a starter prompt | Clear the context and paste |
| **Front end** | Builds the screens from the design notes and the back-end hand-off, then verifies in a real browser (one page), then commits. | The vertical is complete; the final message lists Deleted and Kept | Read the report |

**The hand-off file has a fixed shape (60 lines at most):** (a) worktree, branch, last commit, ports; (b) what is done, one line per item; (c) what is not done, as a checklist; (d) the exact commands for the next stage; (e) at most five files to read first; (f) gotchas; (g) rule slips said plainly; (h) departures from the design or the scope. The starter prompt always begins with the `git fetch` and the branch to be on and ends "do the next stage only".

## The order (waves)
| Wave | Lane 2 | Lane 3 (design) | Lane 4 |
|---|---|---|---|
| 1 | **V0 quick fixes** | **V1 design** (you approve) | **V1 back end and front end** after the design is approved |
| 2 | V2 back end, then front end | **V2 design**, then **V3 design** | V3 back end, then front end |
| 3 | V4 back end | **V4 design**, then **V5 design** | V4 front end (after the design and back end) |
| 4 | V5 back end (small), then front end | | Close-out for Schedule |

Why this order: designs are serial in lane 3 so you only ever look at one design group at a time, and builds follow right behind in lanes 2 and 4. Each vertical's three stages happen in one lane, but lanes are reused as verticals finish.

## Rules that keep parallel work safe
1. **One lane, one session** (check `pgrep -fa claude`).
2. **Each vertical has a "stay out of" list** naming the other verticals' files. Shared files (`nav` and the route gate, the access table, `API_CONTRACT.md`, the Today board's shared parts) change in their own small commit, named in the hand-off.
3. **Paper:** each vertical gets its own Paper page ("Workforce · Schedule · V1", and so on), so designs never collide.
4. **A clean test database per lane**, made from the template in one command (`wendo_rms_test_<lane>`), written into `TESTING.md`; two lanes never share one database.
5. **V0 merges first.** The orchestrator merges every vertical in size order and runs the gates once on the merged result.
6. Nothing ships until the whole feature ships (owner, 24 Oct).
