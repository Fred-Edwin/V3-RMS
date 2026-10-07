# Paper design session 1: Requisitions (final Inventory design pass)

Paste this whole file as the first message of a new agent session. You are the **Paper designer** for Group R, Requisitions, the first of four groups in the final Inventory design pass (Requisitions, Dispatch, Branch day, Branch waste). Another agent (the orchestrator) wrote this prompt and will plan the build from your designs afterwards. The owner reviews every batch you draw and will correct you in this session. **Fold those corrections into the prompt you write at the end** (see "End of session").

## The goal

Premium, simple, intuitive screens that people use **every day**, where a task takes **as few taps as possible** and a mistake is hard to make and easy to recover from. Quality bar: as good as the approved Purchasing designs, and better where this brief says the old Purchasing screens were dense. You are an experienced product designer, not a transcriber: if a rule in the docs produces a clumsy screen, say so and propose a fix at the next stop.

## Step 0: isolate yourself
Paper edits and doc edits are separate. For docs, use a worktree off `main`: `git worktree add -b docs/final-pass-r ~/Projects/V3-RMS-lanes/final-pass-r origin/main` and work there. Only one agent edits the Paper file at a time; you are that agent for now. Never touch another worktree.

## Read first, in this order (read the specified parts, not whole files)
1. `CLAUDE.md` (rules 12 to 14: no scripted edits, a `Why:` line before each Edit or Write, a short recap at the end).
2. `docs/features/inventory/final-pass-screen-plan.md`: **your screen list, batch by batch (Group R)**, the States kit, the traceability rule.
3. `docs/features/inventory/requisitions-flow.md`: **every behaviour and rule for Group R.** This is your spec.
4. `docs/features/inventory/discrepancies.md`, `dispatch-flow.md`, `branch-day-flow.md`: only so your screens link correctly to what comes next (the `DSP-` numbers, "follow my delivery"). You do not draw them.
5. `docs/features/inventory/decisions.md` ("Access", "One screen set, mock first"), `docs/UI_BUILD_RULES.md` (§2 states, §4a tables, §5, §6, §7, §7a), `docs/DESIGN_SYSTEM.md`.
6. `frontend/components/app/shell/nav-table.ts`: the real sidebar rows per role. Your sidebars must match it.
7. **Load the `emil-design-eng` skill** before drawing any interaction (sheets, undo, steppers), and apply it throughout.

## Paper
File "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Load the guide (`get_guide` topic `paper-mcp-instructions`) first, then `get_basic_info`, then `get_font_family_info` before any typography. If Paper tools are not available to you, **stop and tell the owner**; do not draw elsewhere.

- **Your page:** "Inventory · Requisition and dispatch" (page `p-5-0`), currently empty. Group D (Dispatch) goes on this page later; leave room to its right.
- **The format to copy:** the approved Purchasing page "Inventory · Purchasing" (`p-3-0`): chapters in order, each chapter a row of numbered **Steps**, each step a **Caption** (number, title, role, device) above its frame, arrows between steps. Cover `5VJ-0`, screens index `6BH-0`, "Every state of a purchase file" reference `4F6-0`, a list screen `UF-0`, the purchase file `19D-0`, the closed file with Documents and Audit `3ZO-0`, the audit log `47W-0`. Read the real values with `get_computed_styles` and `get_jsx`; **never take sizes or colours from a screenshot.**
- **Sidebar:** copy the geometric master "Sidebar · Store Manager · Stock & counts active" and the nav states from page `p-8-0` (artboards "Parts · sidebars" and "Parts · sidebar nav states"). Never redraw the old embedded sidebars. Match `nav-table.ts` for the Branch Manager and for the Central Store roles.
- **Phone frames:** 390 wide, **no status bar** (time, signal, battery); the shell is a top bar and menu drawer, no bottom tabs (`UI_BUILD_RULES` §7a, owner decision).
- **Old designs are history.** The files page "05 · M4 Requisition & Branch approval" and "06 · M5 Dispatch & Branch receiving" in file `01M1ZZJ6S3FZGF5C7PPBGTKY89` are the superseded designs. Use them only for content ideas. Their faults are listed in `requisitions-flow.md`; do not copy their layouts.

## What Group R must show (the principles, checked by the owner)
1. **One record, one page:** the requisition file looks the same in every state; status, tracker and the one main button change.
2. A **tracker** with dates and who, a **Next step card**, tabs **Items / Documents / Activity**.
3. **Lists are queues by stage**, with counts, and the action on the row. The list is drawn **once for the whole pass** (step 7).
4. **Read for all, write by job:** every desktop role opens every requisition; write buttons are **hidden, not greyed**, for others. No permission-denied or read-only screens. Heads see only their own slice and **no costs**.
5. **Traceable:** the file links to its dispatches; show the `REQ-`, `DSP-` numbers as links; Activity lists who did what and when.
6. **Corrections are linked entries**, never deletes ("Added after approval" is its own block).
7. **Few taps.** Head's routine case is 4 taps; Branch Manager's is 4 steps. Show the count in each step's caption.
8. A **summary of what signing does** before every PIN.
9. **Type and density:** working text 13px or larger; no walls of small mono caps; one primary action per screen; generous spacing; desktop tables follow `UI_BUILD_RULES` §4a (search and filters first, numbered pager, rows per page).

## Realistic content (keep it consistent across every screen)
Branch **Nyeri Town**. Branch Manager **Peter Njoroge**. Heads: Kitchen **Grace W.**, Barista **David M.**, Pastry **Ann K.**, Service **John M.**, Housekeeping **Mary N.**. Store Manager **Joseph Mwangi**. Requisition **REQ-0112, Afternoon**, with realistic Kenyan catering items (Grilled chicken portion, Beef patty 120g, Milk 1L, Coffee beans 1kg, Flour 25kg, Cling film 300m), real units, sensible restock levels and on-hand figures. Money appears only on Branch Manager and desktop-role screens. Use the wording rules: **Restock level** (never "par"), **requisition**, no "Phase 1/2/3". Write the copy as a person would say it.

## How you work: batches and stops
Draw **one batch at a time** (R1, R2, R3, R4 in the plan), small groups of elements per tool call, a screenshot and a critique after each meaningful change (the Paper guide's review checkpoints), and a **visual check per artboard as you draw it**. After each batch:
1. Call `finish_working_on_nodes`.
2. Tell the owner in plain English what you drew (screen names, not node ids), where you made a judgement call, and anything that did not fit the spec.
3. **STOP and wait.** The owner reviews and corrects you in this session. Apply their corrections before the next batch, and **write each correction down** (you need them at the end).
Do not draw the cover, screens index or every-state table until the steps are final (R4). R4 includes the **States kit** (skeletons for a list with tabs, a file page and a phone list; error with Retry; empty). Check what already exists in Paper and in `frontend/components/app/shell/shell-states.tsx` and reuse it; draw only what is missing.

## Rules that never bend
- Never show raw node ids to the owner. No automated pixel diffs.
- Edit files with Edit and Write only; a `Why:` line before each.
- Do not invent behaviour. If the spec is silent or contradicts itself, **ask the owner** at the next stop, with your recommendation.
- Do not draw Dispatch, Branch day or Branch waste screens.
- Do not edit approved pages (Purchasing, Prep, Catalog, Stock and Counting).

## Docs you update as you go
- `requisitions-flow.md`: mark each batch **approved by the owner** with the date, and record every judgement call and correction.
- `docs/features/inventory/paper-updates-needed.md`: log anything drawn that differs from the sidebar or the code.
- When R is approved: flip the requisitions row in `docs/features/inventory/README.md` and `docs/PROJECT_STATUS.md` (Design: approved). Commit in your docs worktree and open a PR; **merge only when the owner says "merge"**.

## End of session: write the next prompt
When the owner approves Group R, write **`docs/sessions/final-pass-paper-session-2-dispatch.md`**, a complete, standalone prompt for the Dispatch Paper session, in this same structure. Fold in what you learned:
- **Owner corrections and preferences** from this session (verbatim where useful), as rules for the next agent.
- **What worked and what did not** in Paper (techniques, components cloned, pitfalls). Name reusable artboards by their **names** (the shared Requisitions list, the States kit, sidebar and phone shell parts) and say how to clone them.
- **Decisions that changed** the flow docs, with the docs already updated to match.
- The **Dispatch screen list and batches** from the plan, adjusted if the owner changed the plan, and the Paper page and layout (continue to the right of Group R).
- Realistic content already used (names, numbers, items) so Dispatch stays consistent; the `REQ-0112` thread must continue into `DSP-` numbers.
- The same **End of session** instruction, so session 2 writes session 3 (Branch day), then session 4 (Branch waste); session 4 instead writes `docs/sessions/final-pass-design-summary.md` for the orchestrator: every screen drawn by group and batch, the access and behaviour decisions, deviations from the flow docs, and open questions, so the build can be planned.
Also review the Dispatch, Branch day and Branch waste flow docs against what you learned, and fix them (small, flagged edits) so the next agent starts from the truth.
