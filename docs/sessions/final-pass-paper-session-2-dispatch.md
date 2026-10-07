# Paper design session 2: Dispatch (final Inventory design pass)

Paste this whole file as the first message of a new agent session. You are the **Paper designer** for Group D, Dispatch, the second of four groups in the final Inventory design pass (Requisitions, Dispatch, Branch day, Branch waste). Group R (Requisitions) is **drawn and approved by the owner (8 Oct 2026)**. Another agent (the orchestrator) will plan the build from your designs. The owner reviews every batch you draw and will correct you in this session. **Fold those corrections into the prompt you write at the end** (see "End of session").

## The goal

Premium, simple, intuitive screens that people use **every day**, where a task takes **as few taps as possible** and a mistake is hard to make and easy to recover from. Quality bar: as good as the approved Purchasing and Requisitions designs. You are an experienced product designer, not a transcriber: if a rule in the docs produces a clumsy screen, say so and propose a fix at the next stop.

## Step 0: isolate yourself
Docs go in a worktree off `main`: `git worktree add -b docs/final-pass-d ~/Projects/V3-RMS-lanes/final-pass-d origin/main`. (If the Group R PR `docs/final-pass-r` is not merged yet, base your branch on it instead, or the flow docs below will be out of date.) Only one agent edits the Paper file at a time; you are that agent. Never touch another worktree. **Do not merge anything until the owner says "merge".**

## Read first, in this order (read the specified parts, not whole files)
1. `CLAUDE.md` (rules 12 to 14: no scripted edits, a `Why:` line before each Edit or Write, a short recap at the end).
2. `docs/features/inventory/final-pass-screen-plan.md`: **Group D, batch by batch**, the States kit, the traceability rule.
3. `docs/features/inventory/dispatch-flow.md`: **your spec.** It is a draft built on recommended defaults; the owner reviews it when you start (see "First actions").
4. `docs/features/inventory/discrepancies.md`: the blind count, the finding, the stock effects. Required for batches D2 and D3.
5. `docs/features/inventory/requisitions-flow.md`: the "Design log" at the bottom has every Group R decision and owner correction; read it, it is the best picture of what the owner likes.
6. `docs/features/inventory/decisions.md` ("Access", "One screen set, mock first"), `docs/UI_BUILD_RULES.md` (§2 states, §4a tables, §5, §6, §7, §7a), `docs/DESIGN_SYSTEM.md`.
7. `frontend/components/app/shell/nav-table.ts`: the real sidebar rows per role.
8. **Load the `emil-design-eng` skill** before drawing any interaction, and apply it throughout.

## Paper
File "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Load the guide (`get_guide` topic `paper-mcp-instructions`) first, then `get_basic_info`, then `get_font_family_info` before any typography. If Paper tools are not available, **stop and tell the owner**.

**Page and layout.** Page "Inventory · Requisition and dispatch" (`p-5-0`). Group R is laid out as **one vertical column starting at the left edge** (the owner asked for this so review is easy): the cover and the screens index side by side at the top, then Chapter 1, 2, 3, 4 each in its own row, with the "Parts · sidebar · Branch Manager · Requisitions active" working part at the bottom (about y 7869 to 8829). **Draw Group D in the same style, below Group R**: start at about y 9100, left edge x 0, one row per chapter, 200px between rows, chapters named "Chapter 5 · ..." onward (Chapter 5 = D1, and so on). Put the Dispatch cover and index in a row of their own at the end of the group, once the steps are final (the cover and index of Group R sit at the top; for Group D place them above Chapter 5). Never overlap artboards. After each batch check positions with `get_basic_info`.

**The format to copy is Group R itself** (look at it first with `get_screenshot` and `get_jsx`; never take sizes or colours from a screenshot): a chapter is one artboard holding a row of numbered **Steps**; each step is a **Caption** (`STEP n` in Geist Mono 12px, a role chip, a title, a tap or time chip) above its frame, with an arrow frame (120px wide, SVG path `M0 8H62M55 2L62 8L55 14`, stroke `#847E76`) between steps.

## What was drawn in Group R (reuse it, do not redraw)
- **Requisitions list (Chapter 2, step 7, and step 7b the Collecting tab):** tabs *Collecting, To approve, To pack, On the way, To confirm, Discrepancies, Closed* with counts; search and filters first; numbered pager and rows per page. **Dispatch has no list of its own**: To pack, On the way, To confirm and Discrepancies are tabs of this one list. Draw the rows that belong to those tabs only if the list step does not already show them (the owner said the list is drawn once for the whole pass; if you need a row in a tab that is not drawn, clone the list step's frame and change the rows).
- **Requisition file with the two-pane layout** (department rail on the left with status, lines, value; the selected department's lines on the right; ink hairlines under the tabs and between the panes): steps 8, 9, 11, 12, 19. Clone the pane node for the dispatch file rather than starting from scratch.
- **Step 13** "Approved file following its dispatches" already shows `DSP-NYR-0231` to `0235`; the dispatch file you draw must be what a click on one of them opens.
- **Step 14** "Follow my delivery" (head's phone) already shows the dispatch status in the head's words; D2 continues it ("Count the delivery").
- **Step 17** is the printed requisition (A4) and the **template for every printed document**.
- **States kit (step 21):** Empty, Empty with an action, Error with Retry (320 by 220, as `shell-states.tsx`), skeletons for a list with tabs, a file page and a phone list. **Do not draw per-screen states.** Draw only a **wording table** for Dispatch (step 20 in the plan), and reuse the every-state table pattern from Group R step 22.
- **Sidebars:** the Branch Manager sidebar part, the Director sidebar (Central Store open, Requisitions active) and the Manage-open variants are in Group R. For the **Store Manager and Store Attendant** use the geometric master "Sidebar · Store Manager · Stock & counts active" and the nav states on page `p-8-0` (artboards "Parts · sidebars", "Parts · sidebar nav states"). Their code row is the single **Requisitions** link (not "Dispatch"; see `paper-updates-needed.md`). Phones use the top bar and menu drawer, **no bottom tabs and no status bar**.

## Owner corrections and rules from Group R (apply them from the first screen)
1. **Titles, not names, in UI copy.** "The branch manager will see what you changed", never "Peter sees...". Names appear only as data (signed by, packed by, activity rows), never in instructions or help text.
2. **Receipt-style summaries, not sentences.** Where a sheet says what will happen (before a PIN), draw a neat summary (total, count of changes, one row per category), not paragraphs of text: "if there are many things it gets out of hand".
3. **Two-pane master-detail, not drop-downs**, wherever a file has sections (department rail plus lines). **Hairlines that divide the page into regions (under the tabs, between the panes) are dark ink, not light grey.**
4. **No function the owner has not approved:** the manager adjusts a quantity themselves (call, clarify, adjust) rather than "returning a section". Don't invent send-back or return flows. If something feels missing, ask.
5. **Every tab must be drawn.** The owner noticed the missing Collecting tab. Every tab the list shows needs at least one screen somewhere in the pass, or a clear note why not.
6. **Every document is drawn**, not just mentioned. Printed documents follow the approved LPO (page `p-3-0`, node `1NY-0`) and supplier statement (`4ZW-0`) template exactly: A4 794 by 1123, 48px side margins, 10px navy `#0B2A4A` top bar, round logo (`https://app.paper.design/file-assets/01M3TP8J54R83RHC9FJ7RAHGKG/01M232X8Y0Y1Q7TPJW5GAB49WM.jpg`) with "Wendo Coffee Bistro" and a grey subtitle, a small mono label above a large mono number and the date on the right, hairline `#D5DCE4`, a two-column info block, a table with a `#` column and mono uppercase headers over a 2px navy rule, row rules `#E3E8EE`, cursive signatures (Alex Brush 36px) with "Signed with PIN · date", a QR code ("Scan to open..."), and the Lobster footer ("Generated by Wendo RMS · Designed and developed by Lobster Technologies"). Clone it from Group R step 17 (`Printed requisition`) instead of rebuilding it. **Money appears on a printed document only if the document is for someone who pays or is paid** (the requisition and the delivery note go to the store: no money).
7. **Document numbers are `#1F5BAE`** (the owner's colour), Geist Mono, underlined when a link. Never copper or amber for numbers. Copper stays for the main button, the active tab and the selected row.
8. **Numbers carry the branch and count per branch:** `REQ-NYR-0112`, `DSP-NYR-0231`, `DSC-NYR-0007`, `DAY-NYR-0044`. Screens lead with a plain label and show the number smaller beside it.
9. **The person who packs also signs.** "Packed and signed by the Store Attendant." The Store Manager appears as signer only when they sign. Check every caption and line of copy for this.
10. **The Director can approve anything** (owner, 8 Oct 2026), with their own PIN, for any branch. Dispatch has no approval step, but the Director reads every dispatch file and discrepancy.
11. **No fake phone status bar**, no automated pixel diff, no raw node ids shown to the owner.
12. **Read for all, write by job:** write buttons are hidden, not greyed, for roles that cannot use them.

## What worked and what did not in Paper
- **Rebuild a chapter in one `write_html` call per step**, not many small ones; large calls can return an "output too large" message but are still applied: verify with `get_children`. Ids of cloned nodes are not predictable; find them with `find_nodes` by text (`textValue`, wildcards like `*Director*`) and then `get_node_info` for the parent.
- **`set_text_content` and `update_styles` take an `updates` array** (nodeId plus textContent / styles); batch many edits in one call. `get_screenshot` needs `fileId`. Screenshots can be stale right after an edit: re-take, and read `get_computed_styles` if in doubt.
- **No CSS margin or grid.** Flex only, with fixed-width slots for columns so rows align (`flex-shrink:0`). Put `min-height:0` on flex children that must not push a footer out.
- **To place an artboard, set `left` and `top` with `update_styles`** after creating it (the creation call ignores them). Create with `create_artboard`, then `write_html` into it.
- **Clone, don't redraw:** `x-paper-clone node-id="..."` in `write_html` copies a node (it is how the Branch Manager sidebar was built from the master). Reusable parts in Group R: the two-pane department pane, the list frame, the file page frame, the drawer (step 11), the PIN sheet on the head's phone (step 5), the dialog over a dimmed page (step 19), the states-kit cards (step 21), the printed requisition layout (step 17), the signature block and the receipt-style summary card.
- **Chapter 2 once vanished** from the file (the steps row disappeared for an unknown reason) and had to be rebuilt. After each batch call `get_basic_info` and `get_children` on every chapter and confirm all steps are still there before telling the owner.
- Duplicating rows (`duplicate_nodes`) and then `set_text_content` is the fastest way to fill a sparse list.
- A fixed 1440 desktop frame and a 390 by 844 phone frame; buttons use `linear-gradient(180deg,#B0610F 0%,#4A1D00 100%)`; tables follow `UI_BUILD_RULES` §4a.

## Decisions that changed the flow docs (already updated)
- Numbering is branch-coded (`requisitions-flow.md` "Numbers"; `dispatch-flow.md` and `branch-day-flow.md` edited 8 Oct 2026).
- The packer signs (`dispatch-flow.md`, "Sign and send" edited).
- "Return a section" is gone; the manager edits the approved quantity and the head is told. The Returned state no longer exists.
- The Director can approve any requisition (`requisitions-flow.md` "Links and roles", "Urgent").
- One combined printed requisition (cover plus one page per department), no money.
- The States kit is drawn once (Group R step 21).
- Deliveries is folded into the list tabs; one **Requisitions** sidebar link per role (`paper-updates-needed.md`).

## Group D screens (from the plan; confirm with the owner before starting)
Chapters 5 to 8.

**Batch D1: Pack it** (Store Attendant, phone; Store Manager shares)
1. To pack: one card per branch, oldest first, expandable by department
2. Pack one department: quantity and on-hand shown, tick each line
3. Short a line or substitute one
4. Sign and send: summary, packed by, signed by (the packer), carried by (carrier picker), PIN
5. On the way

**Batch D2: Receive it** (any active member of the department, phone)
6. Deliveries waiting
7. Count what arrived: blind, no pre-fill
8. This doesn't match: count again
9. Reason and photo for a short or extra line
10. Confirm summary and PIN
11. Confirmed

**Batch D3: The files** (desktop, read by all)
12. Dispatch file: tracker, packed, signed and carried by, documents, activity, ledger links
13. Discrepancy file: the gap, the reason, the photo, the clock
14. Record a finding: four choices, the stock effect shown, PIN
15. Reverse a finding: a new linked entry, reason, PIN
16. Delivery note (A4), store copy and branch copy
17. Carriers list in Settings

**Batch D4: Exceptions and reference**
18. The Branch Manager confirms for a department
19. Cancel a signed dispatch before the branch counts it
20. Every state of a dispatch, every finding with its stock effect, and the wording table
Then the **cover** and **screens index** (same format as Group R's).

## Realistic content (continue the thread; keep it consistent)
Branch **Nyeri Town** (code NYR). Branch Manager **Peter Njoroge**. Heads: Kitchen **Grace W.**, Barista **David M.**, Pastry **Ann K.**, Service **John M.**, Housekeeping **Mary N.**. Store Manager **Joseph Mwangi**. Director **Samuel Gitau**. A Store Attendant is needed for the packing screens (invent one name and keep it).
- **Requisition `REQ-NYR-0112`, Afternoon**, approved with 40 lines, KES 58,020 (money never shown to the store): Kitchen 12 lines (KES 31,260), Barista 8 (12,480), Pastry 9 (8,920), Service 6 (3,260), Housekeeping 5 (2,100). The manager changed Beef patty 30 to 24 and Flour 25kg 6 to 4 bags. After approval the Kitchen head added Chicken breast 4 trays and Milk 1L +6 litres.
- **Dispatches** `DSP-NYR-0231` to `DSP-NYR-0235` (one per department, in the order above), carried by **Wendo van KCB 214K**. Earlier requisition `REQ-NYR-0108` (Morning). Urgent `REQ-NYR-0111` (Extra, Service only).
- Items: Grilled chicken portion, Beef patty 120g, Milk 1L, Coffee beans 1kg, Flour 25kg, Cling film 300m, Chicken breast trays. Use real units and sensible on-hand figures; at least one line must be short at the store ("Short: only 1 in store").
- Money appears only on desktop-role screens that are allowed it. The store sees no money. Wording: **Restock level** (never "par"), **requisition**; no "Phase 1/2/3". Write copy as a person would say it.
- The discrepancy to draw in D2 and D3 is a short count on one Barista line and a recount; use `DSC-NYR-0007`.

## How you work: batches and stops
**First actions, in this order:**
1. Read the files above. Check the Paper tools work; if not, stop and tell the owner.
2. Load the Paper guide, read the page, and look at Group R so you copy its look.
3. Give the owner a **short plain-English summary** of Group D, and list the four defaults at the end of `dispatch-flow.md` ("Defaults taken here") as questions with your recommendation for each. **Wait for the go-ahead.**
4. Then draw **one batch at a time** (D1, D2, D3, D4), a screenshot and critique after each meaningful change, and a **visual check per artboard as you draw it**. After each batch: call `finish_working_on_nodes`; tell the owner in plain English what you drew (screen names, not node ids), the judgement calls, and anything that did not fit the spec; **STOP and wait.** Apply the owner's corrections before the next batch and **write each correction down**.
Do not draw the cover, screens index or every-state table until the steps are final (D4). Each batch is confirmed intact (see the Chapter 2 note above).

## Rules that never bend
- Never show raw node ids to the owner. No automated pixel diffs.
- Edit files with Edit and Write only; a `Why:` line before each.
- Do not invent behaviour. If the spec is silent or contradicts itself, **ask the owner** at the next stop, with your recommendation.
- Do not draw Branch day or Branch waste screens. Do not redraw Group R (change it only if the owner asks, and log it).
- Do not edit approved pages (Purchasing, Prep, Catalog, Stock and Counting).

## Docs you update as you go
- `dispatch-flow.md`: mark each batch **approved by the owner** with the date (a "Design log" section like the one in `requisitions-flow.md`), and record every judgement call and correction. Update the "Defaults taken here" with the owner's answers.
- `docs/features/inventory/paper-updates-needed.md`: log anything drawn that differs from the sidebar or the code.
- When D is approved: flip the dispatch row in `docs/features/inventory/README.md` and `docs/PROJECT_STATUS.md` (Design: approved). Commit in your docs worktree and open a PR; **merge only when the owner says "merge"**.

## End of session: write the next prompt
When the owner approves Group D, write **`docs/sessions/final-pass-paper-session-3-branch-day.md`**, a complete, standalone prompt for the Branch day Paper session (page "Inventory · Counting and closing", `p-6-0`; continue from what is already there), in this same structure. Fold in what you learned:
- **Owner corrections and preferences** from this session (verbatim where useful), as rules for the next agent, plus everything under "Owner corrections and rules from Group R" above that still applies.
- **What worked and what did not** in Paper (techniques, components cloned, pitfalls); name reusable artboards by their **names** and say how to clone them.
- **Decisions that changed** the flow docs, with the docs already updated to match.
- The **Branch day screen list and batches** from the plan, adjusted if the owner changed the plan.
- Realistic content already used so Branch day stays consistent (the `REQ-NYR-0112` and `DSP-NYR-` thread, the blocked-by-an-unconfirmed-delivery case, `DAY-NYR-` numbers).
- The same **End of session** instruction, so session 3 writes session 4 (Branch waste); session 4 instead writes `docs/sessions/final-pass-design-summary.md` for the orchestrator: every screen drawn by group and batch, the access and behaviour decisions, deviations from the flow docs, and open questions, so the build can be planned.
Also review the Branch day and Branch waste flow docs against what you learned, and fix them (small, flagged edits) so the next agent starts from the truth.
