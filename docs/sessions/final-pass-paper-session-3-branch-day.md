# Paper design session 3: Branch day, then Branch waste (final Inventory design pass)

Paste this whole file as the first message of a new agent session. You are the **Paper designer** for Group B (Branch day) and then Group W (Branch waste), the last two groups of the final Inventory design pass. Group R (Requisitions) is drawn and approved. Group D (Dispatch) is drawn and in review by another agent in the same file: **read "Who else is in the Paper file" first.** The owner reviews every batch and corrects you in this session. Fold those corrections into the closing summary (see "End of session").

## The goal
Premium, simple, intuitive screens used **every day**, where a task takes **as few taps as possible**, a mistake is hard to make and easy to recover from. Same quality bar as the approved Purchasing, Prep, Requisitions and Dispatch screens. You are an experienced product designer, not a transcriber: if a rule in the docs produces a clumsy screen, say so and propose a fix at the next stop.

## Who else is in the Paper file (important)
File "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Only one agent should write to a Paper page at a time.
- **The Dispatch agent is still working on page "Inventory · Requisition and dispatch" (`p-5-0`).** It is rolling out new Requisitions sidebar sub-links, updating the Requisitions list tabs, adding a History screen and drawing Dispatch batch D4 (exceptions, every-state and wording tables, cover, index). **Do not touch `p-5-0`.** Read it freely.
- **You work on other pages:** Branch day on "Inventory · Counting and closing" (`p-6-0`), Branch waste on a **new** page "Inventory · Branch waste" (create it with `create_page`). Look at what already exists on `p-6-0` first with `get_basic_info` and `get_screenshot`: continue below or beside it, never over it, and do not edit approved artboards there.
- Docs: the Dispatch agent works in the worktree `~/Projects/V3-RMS-lanes/final-pass-d` on branch `docs/final-pass-d` (flow docs for Dispatch, `paper-updates-needed.md`). Make **your own worktree**: `git worktree add -b docs/final-pass-b ~/Projects/V3-RMS-lanes/final-pass-b origin/main`. If Group R's PR (#94) is merged but the Dispatch branch is not, rebase onto `docs/final-pass-d` when the owner says it is safe, because the Dispatch docs define `DSP-` numbers you link to. **Do not merge anything until the owner says "merge".**

## Read first, in this order (read the relevant parts, not whole files)
1. `CLAUDE.md` (rules 12 to 14: Edit/Write only, a `Why:` line before each Edit or Write, a short recap at the end).
2. `docs/features/inventory/final-pass-screen-plan.md`: **Group B and Group W screen lists, batch by batch**, the States kit, the traceability rule.
3. `docs/features/inventory/branch-day-flow.md` and `branch-waste-flow.md`: **your specs.** Both are drafts built on recommended defaults; review them with the owner at the start (see "First actions").
4. `docs/features/inventory/discrepancies.md`: a delivery that is not yet confirmed blocks a department's day close; a discrepancy never blocks it.
5. `docs/features/inventory/requisitions-flow.md` and `dispatch-flow.md`: **read their "Design log" sections**; they hold every owner correction so far and are the best picture of what the owner likes.
6. `docs/features/inventory/decisions.md` ("Access", "One screen set, mock first"), `docs/UI_BUILD_RULES.md` (§2 states, §4a tables, §5 to 7a), `docs/DESIGN_SYSTEM.md`.
7. `frontend/components/app/shell/nav-table.ts`: real sidebar rows per role.
8. **Load the `emil-design-eng` skill** before drawing any interaction, and apply it throughout.
9. Paper: `get_guide` topic `paper-mcp-instructions`, then `get_basic_info`, then `get_font_family_info` (parameter is `familyNames`, an array) before any typography. If Paper tools are not available, **stop and tell the owner**.

## What the earlier groups look like (copy the look, reuse the parts)
Open Group R and Group D on `p-5-0` with `get_screenshot` and `get_jsx` before you draw anything. Never take sizes or colours from a screenshot.
- **Format:** one artboard per chapter, a row of numbered **Steps**; each step has a **Caption** (`STEP n` in Geist Mono 12px, a role chip, a title, a tap or time chip) above its frame; arrows (120px wide frame, SVG path `M0 8H62M55 2L62 8L55 14`, stroke `#847E76`) between steps. Chapters sit in **one vertical column from the left edge**, 200px apart; the cover and the screens index of a group go at the top (cover 1440 by 900, index about 1808 wide). Working parts (sidebar parts) sit at the bottom, named "Parts · ... (working part, do not copy)".
- **Phone frames** 390 by 844, **no status bar**, a top bar and menu drawer, no bottom tabs. **Desktop frames** 1440 wide.
- **Reusable parts to clone** (on `p-5-0`): "Parts · sidebar · Branch Manager · Requisitions active" (the Branch Manager sidebar with the Branch group open, **Day** is already a row in it), "Parts · sidebar · Store Manager · Requisitions active", "Parts · Requisitions sidebar states", the two-pane department pane (Requisitions file page), the drawer with PIN (Requisitions step 11), the PIN sheet on the phone (Requisitions step 5, Dispatch D5), the dialog over a dimmed page (Requisitions step 19, Dispatch D16), the receipt-style summary card (Dispatch D4/D5, D11), the blind count screen and recount flag (Dispatch D8, D9), the reason chips and photo sheet (Dispatch D10), the States kit (Requisitions step 21) and the every-state and wording tables (Requisitions step 22), the printed A4 documents (Requisitions step 17, Dispatch D17 and D17b).
- **Sidebars:** the geometric master in `p-8-0` (artboards "Parts · sidebars", "Parts · sidebar nav states") is the source; Prep's states are in `p-4-0` node "Parts · Prep sidebar states". **Copy the design only** (see rule 13 below).

## Owner corrections and rules (apply them from the first screen)
These came from the owner in Groups R and D. Treat each as a rule.
1. **Titles, not names, in UI copy.** "The branch manager will see what you changed", never "Peter sees...". Names appear only as data (signed by, activity rows).
2. **Receipt-style summaries, not sentences.** Before every PIN, draw a neat summary (total, count of changes, one row per category), not paragraphs. Many items must not get out of hand.
3. **Two-pane master-detail, not drop-downs**, for a file with sections. **Hairlines that divide regions (under tabs, between panes) are dark ink**, not light grey.
4. **Nothing the owner has not approved.** No invented functions (the owner removed "return a section" and "send a different item"). If something feels missing, ask at the next stop with your recommendation.
5. **Every tab and every document is drawn.** A tab with no screen, or a document only mentioned, is a miss. Printed documents follow the approved LPO (`p-3-0` node `1NY-0`) and supplier statement (`4ZW-0`): A4 794 by 1123, 48px margins, 10px navy `#0B2A4A` top bar, round logo (`https://app.paper.design/file-assets/01M3TP8J54R83RHC9FJ7RAHGKG/01M232X8Y0Y1Q7TPJW5GAB49WM.jpg`) with "Wendo Coffee Bistro" and a grey subtitle, a small mono label above a large mono number and the date on the right, hairline `#D5DCE4`, two-column info block, `#` column table with mono uppercase headers over a 2px navy rule, row rules `#E3E8EE`, cursive Alex Brush 36px signature with "Signed with PIN · date", QR ("Scan to open..."), footer "Generated by Wendo RMS · Designed and developed by Lobster Technologies". Clone from Dispatch D17 rather than rebuilding. **Long documents:** the table continues on the next page; each page repeats the header and column headings and shows "Page n of m"; signatures and the QR appear on the last page only; a line is never split across pages.
6. **Document numbers are `#1F5BAE`**, Geist Mono, underlined when a link. Never copper or amber for numbers. Copper is for the main button, the active tab and the selected row.
7. **Numbers carry the branch and count per branch:** `REQ-NYR-0112`, `DSP-NYR-0231`, `DSC-NYR-0007`, `DAY-NYR-0044`.
8. **The person who packs also signs** (Dispatch). Signing is by role title in UI copy; real names only as data.
9. **The Director can approve anything**, with their own PIN, for any branch.
10. **No fake phone status bar. No automated pixel diff. Never show raw node ids to the owner.**
11. **Read for all, write by job.** Write buttons are hidden, not greyed, for roles that cannot use them. Heads see only their own slice and no costs.
12. **Few taps; say how many in each step's caption.** Departments are phone-first for heads and members; the Branch Manager is desktop-first.
13. **Sidebar sub-links (owner, 8 Oct 2026):** when a link has several pages, use the sub-link **design** of the approved Prep sidebar (parent row with chevron and shaded fill, sub-links indented on their own inner rail, filled square on the active one, counts on the right). The owner said: **take the design only, not the way Prep divides its links.** Work out the sub-links yourself from what people open the page to do, **write them out as a short outline and get the owner's approval before drawing**, then roll them out to every desktop screen. Requisitions ended up with **Queue, Discrepancies, History** under it.
14. **Answer questions before drawing.** When the owner asks "why", "what happens if" or "is this the best", explain in plain words first; draw only when they say go. When the owner asks to see an outline first, give it and wait.
15. **Do not read into references.** If the owner points at a node, take from it only what they say.

## Decisions from Dispatch that you must respect
- One **Requisitions** sidebar link per role (replaces "Dispatch"); Branch Manager has it in the Branch group next to **Day**. Sub-links under Requisitions are **Queue, Discrepancies, History**. Closed requisitions live in History; Discrepancies is its own list.
- Dispatch is **one final review and one signature for the whole requisition**, packed department by department first; each department still gets its own `DSP-` record and delivery note. A short line is sent short, never substituted, never carried over.
- The branch counts **blind** (nothing pre-filled, a mismatch flags and is recounted, then reason and photo), signs with a PIN; the gap is held as unaccounted until the Store Manager records one finding. **An unconfirmed delivery blocks that department's day close**; a discrepancy does not.
- Delivery notes: store copy with quantities, branch copy with a blank "Your count" column.
- Realistic content already used (continue the thread): branch **Nyeri Town** (code NYR); Branch Manager **Peter Njoroge**; heads Kitchen **Grace W.**, Barista **David M.**, Pastry **Ann K.**, Service **John M.**, Housekeeping **Mary N.**; Store Manager **Joseph Mwangi**; Director **Samuel Gitau**; a Store Attendant (title only). `REQ-NYR-0112` Afternoon, 40 lines, five departments, dispatches `DSP-NYR-0231` to `0235`, carrier **Wendo van KCB 214K**; Barista delivery `DSP-NYR-0232` has the milk gap, `DSC-NYR-0007` (24 sent, 22 counted). Barista items: Coffee beans 1kg, Milk 1L, Sugar 2kg, Cocoa powder 1kg, Vanilla syrup 750ml, Paper cups 12oz, Coffee filters, Napkins. Kitchen items: Grilled chicken portion, Beef patty 120g, Chicken wings, Flour 25kg, Cooking oil 10L, Pishori rice 25kg, Tomatoes, Red onions, Sukuma wiki, Avocados, Milk 1L, Eggs. The day is Wednesday 7 October 2026; the afternoon thread runs from 1:41 pm to about 3:36 pm. **Your Branch day must be consistent with it:** the opening count the same morning, department counts that include the milk gap, a close at the end of the day, a day file `DAY-NYR-0044`.

## Group B: Branch day (from the plan; confirm with the owner)
About 13 screens, 3 batches. Draw them as chapters on `p-6-0`.
**Batch B1: Open and count**
1. Opening count (phone): "same as last night?", accept or recount
2. Overnight difference recorded
3. Count my department, blind (phone)
4. Sent, waiting for the manager (phone)
5. **Today** (Branch Manager, desktop): five department tiles, what blocks the close, "Opening not checked"
**Batch B2: Close**
6. A department's figures: opening, received, waste, counted, Used today
7. Reason for an unusual figure
8. Close the day: summary and PIN
9. Closed day file (`DAY-NYR-nnnn`), with ledger links
10. **Correct a count** on a closed day: one item, reason, PIN
11. History, and the unusual-figure rule in Settings
**Batch B3: Exceptions and reference**
12. Blocked by an unconfirmed delivery
13. Every state of a branch day, and the wording table
Then the group's **cover** and **screens index**.
Ledger rule: closing writes one usage entry per item through the stock ledger door, carrying the `DAY-` number; every ledger entry created here shows its number as a link back to the day file.

## Group W: Branch waste (about 7 screens, 2 batches)
Reuses the approved Central Store waste screens (page "Inventory . Stock and Counting" `p-8-0` and its waste chapters). **W1: Log it** (member or head, phone): log waste of several items; check before it is logged; my department's waste today; reverse a wrong entry. **W2: See it** (Branch Manager, desktop, read by all): branch waste by department, reason and value; reverse any entry with a reason and PIN; every state and wording table. Then cover and screens index. Draw only a wording table for states, never per-screen states (`UI_BUILD_RULES` §2).

## What worked and what did not in Paper
- **One `write_html` call per step.** Large calls can return a very long list of created nodes (that is normal, it was applied); verify with `get_children` and a screenshot. Do not paste big HTML repeatedly: build once, then clone.
- **Tool details that bit us:** `get_screenshot`, `get_node_info`, `get_children` need `fileId`. `set_text_content` and `update_styles` take an `updates` array (`nodeId` plus `textContent` or `styles`). `find_nodes` takes `textValue` (wildcards ok) plus `pageId` or `nodeId`; it cannot search by layer name. `get_font_family_info` takes `familyNames`. Node ids of clones are not predictable: find by text, then `get_node_info` for the parent. Sibling ids are sequential in base 36 inside one write, which lets you guess a sidebar's id from a group label; verify with `get_node_info`.
- **To place an artboard,** create it, then set `left` and `top` with `update_styles` (creation ignores them).
- **Swap many copies of a part:** `write_html` with `mode: "replace"` on each instance and `<x-paper-clone node-id="PART_ID" style="align-self:stretch;height:auto;min-height:880px"/>`. Update the part once, then replace each instance (this is how the sidebar sub-links were rolled out). The reply lists every created node; that is large, so batch several replaces in one message.
- **Do not use CSS `repeating-linear-gradient`:** it does not render in Paper (the QR box came out blank). Draw such things as inline SVG.
- **No CSS margin or grid;** flex only, fixed-width slots (`flex-shrink:0`) so repeated rows align; `min-height:0` on flex children that must not push a footer out; for a drawer or dialog use an absolutely positioned frame over a dimmed clone of the screen behind it.
- **A chapter once vanished** from the file (steps row empty) and had to be rebuilt. After each batch run `get_basic_info` and `get_children` on every chapter and confirm all steps are intact before telling the owner.
- Paper screenshots can be stale right after an edit; retake, and read `get_computed_styles` when in doubt.
- Buttons: `linear-gradient(180deg,#B0610F 0%,#4A1D00 100%)`; tables follow `UI_BUILD_RULES` §4a (search and filters first, numbered pager, rows per page); working text 13px or larger.
- Fonts: Geist, Geist Mono, Alex Brush (signatures). Tokens are CSS variables in the file (`var(--color-ink)`, `--color-primary`, `--color-sidebar-top`, success, warning, error, info sets).

## How you work: batches and stops
**First actions, in this order:**
1. Read the files above; check Paper tools; look at Group R and D and at what `p-6-0` already holds.
2. Review `branch-day-flow.md` and `branch-waste-flow.md` against everything above. Fix contradictions with small flagged edits (numbers, titles, the Dispatch rules). Give the owner a **short plain-English summary** of Group B, list the draft's default assumptions as questions with your recommendation, and, if the Day link or Branch waste needs more than one page, **outline the sidebar sub-links first** (rule 13). **Wait for the go-ahead.**
3. Then draw **one batch at a time** (B1, B2, B3, then W1, W2). After each meaningful change take a screenshot and critique it; check each artboard visually as you draw it. After each batch: call `finish_working_on_nodes`; tell the owner in plain English what you drew (screen names, never node ids), the judgement calls, and anything that did not fit the spec; **STOP and wait.** Apply corrections before the next batch and **write each correction down.**
Do not draw a group's cover, screens index or every-state table until its steps are final.

## Rules that never bend
- Never show raw node ids to the owner. No automated pixel diffs.
- Edit files with Edit and Write only, with a `Why:` line before each.
- Do not invent behaviour. If the spec is silent or contradicts itself, ask at the next stop, with your recommendation.
- Do not edit approved pages (Purchasing, Prep, Catalog, Stock and Counting, Requisitions, Dispatch). If a change to one is needed, ask the owner and log it.
- Do not touch `p-5-0` while the Dispatch agent is working there.

## Docs you update as you go
- `branch-day-flow.md` and `branch-waste-flow.md`: a "Design log" section like the one in `requisitions-flow.md`: mark each batch **approved by the owner** with the date; record every judgement call and correction.
- `docs/features/inventory/paper-updates-needed.md`: log anything drawn that differs from the code or the sidebar.
- When a group is approved: flip its row in `docs/features/inventory/README.md` and `docs/PROJECT_STATUS.md` (Design: approved). Commit in your worktree and open a PR; **merge only when the owner says "merge"**. End git commits with the attribution line given in the session reminder.

## End of session: write the design summary
When the owner approves Group W (the last group), write **`docs/sessions/final-pass-design-summary.md`** for the orchestrator, so the build can be planned: every screen drawn by group and batch (with the Paper page and chapter names), the access and behaviour decisions, deviations from the flow docs, owner corrections, the numbering scheme and ledger traceability rules, the sidebar rows and sub-links per role, open questions, and what in the code differs from the designs (`paper-updates-needed.md` is the starting list). Finish with the short plain-English recap that `CLAUDE.md` requires.
