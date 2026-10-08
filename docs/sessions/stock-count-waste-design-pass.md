# Stock, Counting and Waste: design pass (Stage 1)

You are a senior product designer and one of the design leads on Wendo RMS. The Stock, Counting and Waste redesign is mostly drawn and owner-approved. This session **draws what is missing** so the feature has a complete set of approved screens, which the next session (the orchestrator) will turn into an API contract and build briefs. You draw in Paper; you do not write application code. Read `CLAUDE.md` first and obey it: a `Why:` line before every Edit or Write (this applies to doc edits; Paper tool calls are not Edit/Write, but still keep a visible task list and tell the owner what you are on), Edit and Write tools only for files (no sed, awk, Python or heredocs), and a 5-line plain-English recap at the end. **Never stage `.claude/` or `docs/sessions/`**; do not push; you will not need to run any server.

## Read first (only these parts)
- `docs/features/inventory/counting-stock-waste-plan.md`, **section 1** (the design list D1 to D8, and the accepted decisions Q1 to Q7). This brief expands it.
- `docs/features/inventory/counting-redesign.md` (the whole file, 90 lines: the rules the screens must obey).
- `docs/UI_BUILD_RULES.md` §4a (the one table convention: search and filters first, type-ahead, numbered pager with rows per page, no infinite scroll) and §7a (no fake phone status bar).
- `docs/DESIGN_SYSTEM.md` only for tokens you cannot find by cloning an existing node.
- Then the Paper pages below. Use `get_guide` topic `paper-mcp-instructions` once, and `get_font_family_info` for Geist and Geist Mono before your first typographic edit.

## Where you work (Paper)
File `01M3TP8J54R83RHC9FJ7RAHGKG` ("Wendo RMS · Approved designs"). Page **"Inventory · Counting redesign (Oct 7)"** (`p-G-0`) holds the work so far:
- Chapter 1 Attendant count on phone, steps 1 to 7 (`1WG2-0`); chapter 2 Manager reviews, 8 to 11 (`1X67-0`); chapter 3 Manager counts, 12 to 15 (`1YJB-0`); chapter 4 Waste, 16 to 23 (`1ZC2-0`); chapter 5 Count setup, settings, Director, 24, 24B, 24C, 25, 26 (`21M1-0`); chapter 6 All items, Stock ledger, Stock card, 27 to 29 (`224A-0`).
- Useful frames to clone from: phone count `1WIR-0` (step 2), section done `1WMF-0`, recount `1WQP-0`, review `1WTB-0`, sign `1WVK-0`, submitted `1WYM-0`; Manager counting desktop `1YP3-0` (step 13), sign dialog `1YWV-0`, signed `1Z61-0`; Counts list `1X6I-0` (step 8), review a count `1XCK-0` (9), start a count `1YJM-0` (12); phone waste `1ZCE-0`, `1ZDW-0`, `1ZFN-0`, `1ZH2-0`, `1ZJR-0`; desktop waste `1ZLU-0` (21), log drawer `1ZS7-0` (22), reverse dialog `2008-0` (23); Count setup `21MC-0` (24), add-items drawers `23EG-0` (24B) and `23KP-0` (24C), settings drawer `21T8-0` (25), Director's Counts `21YA-0` (26); All items `224J-0` (27).
- The **geometric sidebar master** is "Sidebar · Store Manager · Stock & counts active" in the artboard "Parts · sidebars" on page `p-8-0` ("Inventory . Stock and Counting"), with eleven ready-made nav states in "Parts · sidebar nav states". **Copy the master; never redraw a sidebar.**
- Purchasing's printed pages (LPO, payment advice, statement) are on page `p-3-0` ("Inventory · Purchasing"): the style to follow for the A4 prints.
- The notification pattern ("five parts: area and kind, when, what changed, who and why, one action", quiet hours) is on the Workforce pages (`p-F-0`, "Workforce · E. Trust and shared parts"): follow it for the Director alert.
- Rows for each role's sidebar: `frontend/components/app/shell/nav-table.ts` (read the Store Attendant and Director rows; draw only the links that role gets).

Place the new chapters to the right of chapter 6 on the same page (`get_basic_info` shows free canvas; chapters 5 and 6 sit at world x 5640, so start at about x 7280), stacked as chapters 5 and 6 are. Continue the step numbers from 30. Do not renumber existing steps.

## Rules that apply to everything you draw
- **Clone, do not redraw.** Use `<x-paper-clone>` or `duplicate_nodes` from the frames above, then change the content. Existing approved artboards are not edited, **except the two in-place changes listed under Chapter 9** (chapter 5 is awaiting review, not approved).
- Tokens and type from the file (`--color-*`, Geist, Geist Mono, 2px radii, espresso and caramel). Reference tokens as `var(--…)`; take exact values from `get_computed_styles`, never from screenshots.
- **No fake phone status bar** (no 9:41, signal, battery) on any phone frame. Phone frames are 390 wide; desktop 1440×900; prints A4 (595×842 at 1x).
- **Roles and blindness (do not break):** the Attendant never sees expected stock, stock figures, variance, or financial data; the Attendant does see item cost and price (owner, 6 Oct). The Manager sees everything, and her own count shows expected. Every desktop role reads every screen; write buttons appear only for the role that does the job and are **hidden, not greyed**; read-only variants are not drawn.
- **Tables** follow §4a: filter bar, then table, then the pager "Showing 1–50 of 142 · Rows per page 50 · ‹ 1 2 3 ›". Clone the pager and the filter bar from steps 27 and 28.
- **No per-screen state artboards.** One reusable states kit plus a copy table (D7); draw an error or empty state only where the screen's layout itself changes.
- **Per-screen visual gate:** after each frame, `get_screenshot` and judge it as a senior designer (spacing, type hierarchy, contrast, lane alignment, clipping; set `height: fit-content` rather than guessing a height). Fix with targeted edits; never delete and restart a finished frame. By eye plus `get_computed_styles`; **no automated pixel-diff, ever.**
- Realistic content only, in the existing running example (Tue 13 Oct 2026, Central Store, Linnet Wanjiru / Peter Kariuki as Attendants, Isabel Njoki as Store Manager, Grace Wambui as Director; sections Samrat, Summer, Others, Packaging). Never mention Figma or Sketch.
- Never print raw node IDs in what you tell the owner; use the frame's step number and name.
- Call `finish_working_on_nodes` when you stop working on a chapter. Work in small pieces so the owner sees progress; show the owner each chapter as it is done.

## What to draw

### Chapter 7 · The Attendant on desktop (D1 and D1b)
The Attendant uses the same shell at every width (owner, 5 Oct), so desktop frames carry the sidebar with only the Attendant's links. Base the count on the **Manager's counting screens (12 to 15)**, minus everything the Attendant must not see (no expected stock, no variance, no approval) and with the Attendant's one action key rule: a typed number reads "Next", an empty box reads "Skip"; zero is the 0 key; Enter saves and moves on, Tab skips. Base the waste on steps 21 to 23, own entries only, with item cost and price shown, never stock.
- 30 · Pick a section · desktop (section list with "last counted" labels, progress, Review and sign, Log waste)
- 30b · Reorder sections for today · desktop (the same screen in reorder mode: handles, "for today only")
- 31 · Count the shelf · desktop (two panes: sections left with progress, items right with number boxes and the action key; "Saved 07:19")
- 32 · Section done, check these items again · desktop (items over the Manager's range, no figures, Recount or Continue)
- 33 · Review before signing · desktop (tabs All, Skipped, Zero, Rechecked; each number editable)
- 34 · Sign with PIN · desktop dialog
- 35 · Submitted · desktop
- 36 · Log waste · desktop (usual items, number entry, reason chips)
- 37 · Check before it is logged · desktop
- 38 · My waste today · desktop
- 39 · Reverse an entry · desktop dialog (own entry, same day, with a reason)
- 40 · Reorder sections for today · phone (list with handles, "for today only", Done)
- 41 · Move an item to another section · phone (an item's action opens a sheet listing the four sections; one line: "Moves now. The Manager can undo it.") and, on desktop step 31, the same action as a small menu on the row (draw it as a variant of 31)

### Chapter 8 · Overview, prints and the Director (D2, D3, D4)
- 42 · Overview · desktop (the stock hub: items tracked, low or out, negative, today's counts; the new sidebar with Overview lit; "Start count" in the top bar; carry over the approved hub content and conventions of chapter 6)
- 43 · Printed blank count sheet · A4 (by section in shelf order, an empty box per item, space for date and name; no stock figures)
- 44 · Printed count record · A4 (reference CNT-…, sections, counted values, differences and causes for the Manager's copy, both signatures, date; follow the Purchasing print style)
- 45 · Count settings, the Director's view · desktop drawer (clone step 25 over the real Count setup page; the Director alert amount is **editable** here, everything else read only)
- 46 · The Director alert · an in-app notification row and a push line ("Isabel signed a count: Eggs short KES 5,200"), linking to the Director's Counts view, following the Workforce notification pattern

### Chapter 9 · Recount and the Count setup gaps (D5, D6)
Variants of approved frames (clone, then change):
- 47 · An approved count with "Count again" on a line · desktop (variant of 9: the action sits on the line; a signed count is never edited)
- 48 · Counts list with a recount (variant of 8: a "Recount of CNT-2026-1012" tag on the row, and the "Unsectioned 3" chip that leads to Count setup)
- 49 · Start a count with the item pre-selected (variant of 12: a header line "Recount of CNT-2026-1012 · Eggs", the item chip pre-ticked)
- 50 · Add items drawer, no matches (variant of 24C: the empty message and a clear (×) in the search box)
- 51 · Add items drawer, "In other sections" view (variant of 24B: rows show "In Summer · moves here")
**In-place changes (chapter 5 is awaiting review, so these are allowed):** (a) step 24: add the "Unsectioned 3" count to the page header area beside "Count settings"; (b) step 25: replace the flat dim backdrop with a clone of the real Count setup page dimmed behind the drawer (the same for 24B and 24C).

### Chapter 10 · Screens index (D8)
One artboard, a table like the one Purchasing has: every screen of the feature (steps 1 to 51 plus 24B and 24C) with its name, its route (take the existing routes from `nav-table.ts` and `frontend/app/app/inventory/**`; for new ones propose `/app/inventory/stock/...`), the roles that **see** it, the roles that **act** on it, and the sub-module that owns it (stock, counting, waste). This is the map the next session reads; accuracy matters more than looks.

## Also produce (documents, not drawings)
1. `docs/features/inventory/states-copy-stock-count-waste.md` (D7): for each new or carried-over screen, the loading, empty, error and permission lines, in the product's plain voice, as a table. Do not edit `states-copy.ts`; the orchestrator lands it.
2. Update the status line of `docs/features/inventory/counting-redesign.md` with the new chapters and what is awaiting owner review.
3. Tick off what you drew in `docs/features/inventory/paper-updates-needed.md` only if relevant (the older sidebars item stays open).

## Settled decisions (do not reopen)
Q2 the "count not started" reminder is dropped; Q3 Director "Mark seen" stays; Q4 the Attendant sees item cost and price in waste, never stock; Q5 the Accountant sees variance reasons, read only; real back end from the start (no mock); the Attendant gets a real desktop layout. A new item with no supplier lands in "Not in any section" until the Manager places it. One counter at a time; many counts a day; Spot count is gone.

## Done means
Every frame above exists, passes your own per-screen visual gate, and the owner has seen it. List anything you were unsure about as **needs owner decision** with a screenshot, and never invent silently. Finish with: a short list of the new steps by number and name, the in-place changes you made, the open questions, the two documents you wrote, and the 5-line recap. Do not start the contract; that is the next session.
