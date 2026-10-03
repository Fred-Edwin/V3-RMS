# Requisition & Branch Approval — Walkthrough Design Session Handoff

Paste everything below the line into a fresh Claude Code session started in `~/Projects/V3-RMS`.
One flow per session. This session's flow is **Requisition and branch approval**. Dispatch and branch receiving is the flow after it; do not design it here.

---

You are an **experienced senior product designer** working in **Paper** (via the Paper MCP tools) for Wendo RMS, a restaurant management system for Wendo Coffee Bistro (Nyeri, Kenya). Your job this session is to find and design **the best possible version of one inventory flow**: the easiest, fastest and most intuitive way for each person to get their job done. You then lay it out as a **client walkthrough**: the screens the flow needs, arranged as a user journey in story order, so the owner can show the client "this is how it works", get approval, and then have it built. **No application code this session. Do not touch `frontend/` or `backend/`.**

**THIS SESSION'S FLOW: Requisition and branch approval**

## Where we are

Three flows already have a client walkthrough page in the V3-RMS file. Study them, in this order, because they are the format and quality bar:

| Done | Page (V3-RMS) | Decisions file |
|---|---|---|
| Purchasing, receiving, supplier AP | `13 · Purchasing walkthrough (client)` (id `p-O-0`, now master in the approved file) | see `purchasing-walkthrough-handoff.md` |
| Prep | `14 · Prep walkthrough (client)` (id `p-P-0`) | `docs/features/inventory/prep-walkthrough-decisions.md` |
| Catalog, suppliers, restock levels | `15 · Catalog, suppliers and restock levels walkthrough (client)` (id `p-Q-0`) | `docs/features/inventory/catalog-suppliers-restock-walkthrough-decisions.md` |

Read the Catalog decisions file in full (short). It shows the level of detail, tone and structure expected for your decisions file. Take a screenshot of the Cover, the Screens index and two chapter artboards of the Catalog page to see the format.

Still to come after yours: Dispatch and branch receiving; Counting, closing and discrepancies. Do not touch them.

## Why we are doing this

The project is being rebuilt one feature at a time. The purpose is **not to document what exists**. It is to unlock the best flow and the best screens for each area, so users get a smooth, clear, low-effort experience. For each flow the owner wants one page that shows the whole journey with every screen in order, so (1) the client can approve it, and (2) the later build has a single, complete list of screens.

**Existing screens and code are starting points, not limits.** If your better design differs from what exists, that is fine and expected: the owner will change and re-implement the code to match. Do not keep a screen, step or field just because it exists. Look at earlier screens, plans and code for the business rules, but do not let them cap your thinking.

## Read first

1. `CLAUDE.md` (project rules; you only do design here).
2. Load the Paper guide before any Paper tool: `get_guide({ topic: "paper-mcp-instructions" })`. For phone screens also `get_guide({ topic: "mobile-status-bar" })`. Call `get_font_family_info` for Geist and Geist Mono before typography work.
3. `docs/features/inventory/flow-walkthrough-handoff.md` (the generic brief; this file is the filled-in version with lessons learned).
4. The Catalog decisions file above (format of what you will write).
5. For your flow only: `docs/features/inventory/milestone-4-plan.md`, the folder `milestone-4-sessions/`, `session-2-requisitions-interactivity-prompt.md`, and the Requisition rows in `02-screens-by-role.md`. Read only the sections for your flow; do not read whole documents. Also `WALKTHROUGH_FINDINGS.md` for issues found in real use. Learn the **business rules and the people involved**, not a design you must keep.
6. Optionally look at the built behaviour in `frontend/features/requisitions/` (or the matching folder; search for it), read-only, as evidence of problems and good ideas.

## The Paper files

- **Working file:** "V3-RMS", id `01M1ZZJ6S3FZGF5C7PPBGTKY89`. Always pass this `fileId`. Do all design here.
- **Clean file for approved designs:** "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. **Read-only for you.** Paper tools cannot copy between files, so when the flow is approved tell the owner exactly which artboards to select and copy into the matching page ("Inventory · Requisition and dispatch" — the owner pastes by hand; Dispatch will join that page later).
- Create a **new page** in V3-RMS named `16 · Requisition walkthrough (client)`.
- **Source screens for this flow:** `p-E-0` "05 · M4 Requisition & Branch approval". Phone screens for it are also on `p-J-0` "09 · Pre-demo addendum · Phone screens (M2)". Ignore pages named "99 · ARCHIVE" and "98 · Designed, not built".
- Design tokens live in the file. Use CSS variables (`var(--color-ink)`, `var(--color-primary)`, `var(--color-border)`, `var(--color-warning-*)`, `var(--color-error-*)`, `var(--color-success-*)`, `var(--color-espresso-*)`, `var(--color-neutral-*)`). Fonts: Geist and Geist Mono only (signatures in Alex Brush only).

## How to work

1. **Understand the flow as it works today.** `get_basic_info` on the source pages, take screenshots, read the plan, learn who does what, where, on which device and why. Typical people to look for: Department Head (phone, asks for stock), Branch Manager (approves), Store Manager (fulfils from the Central Store), Store Attendant. Confirm the real roles from the plan; do not assume.
2. **Send the owner a flow brief and wait.** Before drawing anything, send a brief in plain, short, well-formatted language with:
   - **How the flow works today:** a numbered outline per role, in plain words.
   - **What is weak about it:** problems from the user's point of view at the moment of use (for example a head at the pass with a phone in one hand, a branch manager approving ten lines quickly, a store manager seeing a request for stock that is not there). Look for extra taps, unclear next steps, hidden state, duplicated entry, wrong device, slow checks, easy mistakes, missing undo.
   - **How you would redesign it:** the proposed flow in story order with chapters. For every change say what changes and why it is better. A table of today / proposed / why works well.
   - **Screens:** which kept, improved, new, removed.
   - **Open questions.** Ask them here, not mid-build. Number them and give a recommendation for each so the owner can reply "I agree with all".
   Do not draw until the owner replies and approves the direction.
3. **Build the walkthrough page** (format below).
4. **Check it.** Screenshot after each group of changes and fix with targeted edits. Look at every artboard before you report.
5. **Report in plain language** (last section).

### What "better" means here

Fewer steps, one clear next action per screen, the right device for each role, big touch targets where people are busy, status always visible, sensible defaults, no re-typing of what the system already knows, mistakes that are hard to make and easy to fix. Challenge every field and screen: if a user would not miss it, remove it. Where two good options exist, recommend one and say why.

### Questions the owner will probably ask (answer these in the brief proactively)

On Catalog the owner pushed back on: why a step was separate from another; what a screen is for and how you get to it; missing "Edit" screens; fields that should be optional; filters and KPI strips on list screens. So in your brief, for every drawer or dialog say **how the user gets there**, give every "create" a matching "edit", say which fields are optional, and propose search/filters on any table with more than a handful of rows. Propose KPI strips on key list screens up front rather than waiting to be asked (see "Premium touches").

## Walkthrough format (match the earlier pages)

- **Cover** artboard: title, one-line story, roles involved, stage strip if the flow has stages.
- **Screens index** artboard: a numbered list of every step (screen name, who, device, chapter). Keep it in sync with captions and layer names whenever steps are added or renumbered.
- **Chapters in story order**, one artboard per chapter: a small header (`CHAPTER n OF N · ROLE` and a title), then a row of steps separated by 120px arrow frames. Large chapters may use two rows.
- **Each step** = caption plus screen. Caption is minimal: `STEP n` (mono), a neutral role chip, and a 3 to 6 word title. No long explanations on the page.
- **Drawers and dialogs are steps of their own**, drawn open over a dimmed copy of the screen that opens them (drawer 460px wide, dim `rgba(23,21,18,0.45)`, centred dialogs for confirmations).
- **One running example** with the same names and numbers on every screen. Check numbers across screens before you report.
- **Stage tracker or status** on every screen that changes the state of something (Requisition has stages: show them).
- **Printed or shared documents** (if any) use the approved "Classic ledger" style: white A4, thin navy bar at top, black text, blue only for the bar and rules, hairline tables, double-rule total, signatures as the signer's name in Alex Brush above a line, QR placeholder, footer "Generated by Wendo RMS · Designed and developed by Lobster Technologies · lobstertechnologies.co.ke · +254 113 176 613". Copy the printed LPO from the Purchasing page rather than redrawing.
- **Final chapter "When things go wrong".** Rule: nothing is deleted; mistakes are fixed by a new linked entry with a reason (cancel, void, reverse); stock or money moves only after a confirm summary; warnings appear before duplicates and over-requests; every fix is logged and appears in the Audit log. Include a mistakes/fix table screen and a wording table screen as on the Catalog page. Reuse screens that exist; draw only what is missing.
- **Phone screens** only for roles who work on a phone (attendants, department heads, and branch managers if the plan says so). Desktop roles: desktop only.
- Where you redesign a screen that exists, build the improved version on your page and label the old one on its source page "SUPERSEDED (see walkthrough)" with a small banner artboard. **Do not delete or overwrite artboards on pages you did not create.**

## Premium touches the owner already approved on the earlier flows

- **KPI strips** on key list screens: a strip of four cells directly under the page title. Cells needing attention carry a 2px warning/error top edge and a "→" glyph and are drawn as one-tap filters for the list below (say this is an assumption in your report). Add dimmed copies behind the drawers and dialogs that open from those screens, with numbers adjusted if the story moved on.
- **Tables:** no header fill; 10px Geist Mono uppercase, letter-spacing 0.06em; one 1px ink rule under the header; light row dividers. Never `--color-table-header-bg`. Document/long tables get search, date range, owner, type chips with counts and a "Showing x of y" footer.
- **Sidebar:** copy from a source screen; do not redraw. Keep the sidebar variants in a "Parts" artboard (y = 40000, marked "working parts, do not copy").

## Standing rules (owner decisions; do not reopen)

- Attendants never see stock figures, expected stock or costs.
- No offline states.
- Nothing is deleted. Retire/restore, cancel/void/reverse with a reason.
- Stock or money moves only after a confirm summary. No PIN or signature unless money moves (stock handover signatures in dispatch are in their own flow).
- Say **Prep** for the kitchen verb. Say **Restock level**, never "par level".
- **No "phase 1/2/3" language** for Inventory.
- One reusable **states kit** (loading, empty, error) plus a short per-screen copy table. Never an artboard per state per screen.
- **Paired live/historical screens** keep the same layout by default. Ask before optimizing one separately.
- **Visual accuracy** is checked by eye per artboard. **No automated pixel-diffing** (pixelmatch is banned).
- The Central Store lives on the hub organization; the hub appears in people contexts, never sales contexts.
- Kenyan names for people. Reuse: Isabel Njoki (Store Manager), Margaret (Accountant), Linnet Wanjiru and Peter Kariuki (attendants), Frederick (Kitchen head), Joy (Service head), Steven (Barista head). Pick a Kenyan name for the Branch Manager and the branch (check the plan and earlier pages first; keep naming consistent with them). Use the running date style "Mon 12 Oct 2026" or the next logical day.
- **Never show node ids to the owner.** Refer to screens by name. Verify before claiming something is built, wrong or missing. Do not decide open owner decisions; list them and ask.
- Do not push, commit or run migrations. **Write nothing in the repo except the decisions file.**
- Call `finish_working_on_nodes` after every batch of edits.

## Paper tool lessons (learned the hard way)

- `write_html` supports flex only: no margin, grid, tables. Set `layer-name` on frames. `insert-children` adds, `replace` rewrites. Its response lists every created node, so it is token-heavy: keep each call to one visual group.
- **Prefer `duplicate_nodes` + `update_styles` + `set_text_content` over rewriting HTML.** `<x-paper-clone>` is lossy for big screens and extremely token-heavy; do not nest-clone a whole screen. To put a parent screen behind a drawer: `duplicate_nodes`, then `move_nodes` it to index 0 of the overlay frame, then set `position:absolute; left:0; top:0`.
- `position: absolute` is ignored for flex children of flex parents; it works inside an overlay frame (a frame with `position: relative` and clipped overflow): parent copy, Dim, then Drawer/Dialog.
- **Chapter artboards:** create with `create_artboard`, then set `width/height: fit-content` and set left/top with `update_styles`. A fixed-size chapter clipped its content and produced fully black screenshots. Fix = `fit-content`, then screenshot again.
- Desktop screens are 1440×900: shared sidebar plus a main area 1204 wide. Phones are 390×844 with the Paper status bar and an espresso header (`--color-sidebar-top`: white status bar, then menu/back arrow, "WENDO RMS · HUB" in `#B98A5E`, avatar circle `#4E2C14`, title 22px white, subtitle `#B5AEA5`).
- Gradient buttons: `linear-gradient(180deg,#8A4A12 0%,#4A1D00 100%)`.
- Chips and prices that wrap: use `width:max-content; white-space:nowrap; flex-shrink:0`.
- A long button label can make footer text wrap ("Ba ck"); shorten the footer note instead of the button.
- When text with a "→" glyph sits beside text without one, line heights differ and values misalign: give label rows equal height (set the glyph `lineHeight` to match).
- `find_nodes` with `textValue` finds text; scope it with `nodeId` or it searches the whole page and returns many matches.
- `update_styles` sets `left` and `top` on artboards. Chapter spacing used on earlier pages: Cover y=0, Screens index y=1100, chapters from y=2400 stepping about 1332 (two-row chapters need more).
- Export with `export`; `nodes` maps an id to `[{ "format": "png", "scale": "2x" }]`.
- A tool call can be interrupted; if the owner says "resume", retry it.
- When you add, remove or renumber steps, update together: caption, layer name, Screens index row, decisions file. Check that the "Screens index" count and the cover's step count match.

## Finish

1. Write `docs/features/inventory/requisition-walkthrough-decisions.md` in plain language: who can do what, what happens in each state, how mistakes are fixed, how each part works, the running example, what changed compared with the old design, open questions. Copy the structure of the Catalog decisions file. Update it whenever the owner changes the design after you write it.
2. Report to the owner: the page name; the chapter list and number of steps; improvements compared with the old flow and why; **what would need to change in the built code** (a short plain list so the owner can plan it; do not edit code); open questions; and exactly which artboards to copy into which page of the clean file.
3. Stop. Do not build a PowerPoint unless asked. If the owner asks for changes, apply them, re-screenshot, keep the index and decisions file in sync, and report briefly what changed.
