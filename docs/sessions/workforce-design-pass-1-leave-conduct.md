# Workforce design pass 1: Leave and Conduct (Chapters 10 and 11)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 1 worktree. **This is a design session: no application code is written.**

---

You are a product designer and tech lead on Wendo RMS. The owner (not a designer or developer) is reviewing Paper Group C, "Workforce · C. Leave and conduct" (file `01M3TP8J54R83RHC9FJ7RAHGKG`; Chapter 10 Leave, Chapter 11 Conduct) and **does not approve it as drawn**. This session works *with* the owner: **explain first, the owner decides, then redraw.** Unlike the build sessions, here you may ask the owner questions, but only the ones listed in Phase 1, in one batch, with your recommendation first on each. Everything else you decide and log.

### The owner's feedback (verbatim intent)
1. **Chapter 10, step 2 (My leave, phone):** they don't like it. Redesign so a person sees at a glance how many days they have **left and have taken** for each leave type (annual, sick, family emergency; use the types the Rules Leave tab really defines).
2. **Chapter 10, step 13 (HR adjusts a balance):** the "5 days + 2 = 7 days" block has a horizontal alignment problem. Fix it, **and find every other screen in Chapters 10 and 11 with the same pattern** (an equation or a label, value and result row) and fix them the same way. List any such screens you find in Chapters 12 to 17 in your report without changing them (a later session owns those).
3. **Flow of the staff screens is unclear.** They want, for a staff member: a **Leave home** with the headline numbers (days left, days taken, anything pending); a **Request** page; a **History** page; and a **follow-up page for each request**.
4. **Request progress:** each request shows its progression as a clear stepper with circles (submitted, then each decision step, ending approved or declined; green circle for done, a distinct state for the current step, a clearly different one for declined). Read the real approval chain in Chapter 10 (who approves, the 3-day escalation to HR) and draw exactly that.
5. **Chapter 11, warning letters:** it is unclear whether HR writes them, where they are written, or whether everything is pre-written. Explain how it works in the current design and propose the clearest model.
6. **Staff conduct page:** will a staff member have a Conduct page on the phone where they receive notices (verbal note, written warning), see **all** their conduct documents, and **download** them? Make this clear and draw it.
7. **Ordering:** it must be obvious in what order the Chapter 10 and 11 screens are used. Re-order and renumber the steps so a reader follows one story (staff first, then manager, then HR).

### Phase 1: explain, then ask (do this first, before any Paper edit)
Read Chapters 10 and 11 live (Paper: `get_basic_info`, find the two chapter frames on the page; `get_guide` with `paper-mcp-instructions` once; use `get_tree_summary` and `get_screenshot`, `get_jsx` only where needed). Read the Chapter 10 and 11 rows and the owner decisions in `docs/features/workforce/README.md`, `proposal.md` for leave, conduct and documents, and the Rules Leave and Conduct tabs in Chapter 13 (only to know which settings exist). Then post **one message** to the owner in plain language (no jargon, short sentences, one small table per topic):
- **How leave works today in the design**, end to end: who asks, who approves, minimum cover, the rota clash, the 3-day escalation, balances (calendar days; 21 a year, 1.75 a month), the leave slip.
- **How conduct works today in the design**, end to end: who may issue, what is written by hand and what comes from a template, what facts are attached, signing, appeal, who decides the appeal, and what the staff member can see.
- **Your proposal** for points 1 to 7, with a sketch in words of each screen, in order.
- **Questions for the owner** (at most 5, each with your recommendation first): for example who writes the body of a warning (recommendation: the manager picks the level and adds the facts; the wording is a template the Director sets in Rules; HR reviews and decides appeals only), and whether a staff member can download PDFs of their own notices.
Then **stop and wait for the owner's answers**.

### Phase 2: redraw in Paper (only after the owner answers)
- **Paper is direction; do targeted edits, never delete a whole frame and start over.** Redraw the screens that change; keep node names meaningful; clone existing parts rather than rewriting them (`<x-paper-clone>`); one visual group per `write_html`; after each change `get_screenshot` and check spacing, alignment, contrast and clipping; call `finish_working_on_nodes` when done.
- Rules that already hold: the approved Workforce look and the geometric sidebar master; the approved range picker for every date choice; **no phone status bar**; Joy Chebet's balance is 5 days everywhere; no publish wording; one calendar-month timesheet period; every number in sample data must agree across screens; documents follow the LPO document style (navy, Times New Roman, Alex Brush signature, "Signed with PIN", QR, footer); no "she/her" in copy.
- Build the new staff flow (Leave home, Request, History, request follow-up with the stepper) on the phone Home style already approved in Chapter 1, and the manager and HR versions on desktop. Reuse the stepper pattern for both leave and conduct (a notice or appeal also has steps).
- Fix the equation/summary alignment with fixed-width columns and one shared layout, then apply it to every screen that has the pattern.
- Update the shared wording table rows, the "Not drawn yet" frames and the step captions so the chapter reads in the new order.
- Keep an exact change log of every frame you edited or added (frame name and what changed).

### Phase 3: documents
Update, with the Edit and Write tools only (never sed, awk or heredocs; one line starting `Why:` before each edit): the Chapter 10 and 11 rows in `docs/features/workforce/README.md` and the "Decisions" paragraphs for leave and conduct; write `docs/features/workforce/design-pass-1-leave-conduct.md` (what the owner decided, in a table of *question, decision, why*, plus the change log). Commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nothing pushed. Do not touch `backend/` or `frontend/`.

### Final message
Open with the table of what the owner decided and what you decided on their behalf, then a 5-line plain-English recap, then the list of changed and new Paper frames in the order to review them. Say plainly that **the chapters are ready for the owner's approval, not approved**. Do not draft the next session's prompt.

### Cost
No subagents. Read only what is named. Do not re-read a frame you have already read.
