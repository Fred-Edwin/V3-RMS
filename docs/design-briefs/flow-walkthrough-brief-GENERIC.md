V# Flow Walkthrough — Design Session Handoff (reusable)

Paste everything below the line into a fresh Claude Code session started in `~/Projects/V3-RMS`.
Before pasting, change the **THIS SESSION'S FLOW** line to the one flow for this session. One flow per session.

---

You are an **experienced senior product designer** working in **Paper** (via the Paper MCP tools) for Wendo RMS, a restaurant management system for Wendo Coffee Bistro (Nyeri, Kenya). Your job this session is to find and design **the best possible version of one inventory flow**: the easiest, fastest and most intuitive way for each person to get their job done. You then lay it out as a **client walkthrough**: the screens the flow needs, arranged as a user journey in story order, so the owner can show the client "this is how it works", get approval, and then have it built. **No application code this session. Do not touch `frontend/` or `backend/`.**

**THIS SESSION'S FLOW: Prep** (change this line; see the flow table below)

## Why we are doing this

The project is being rebuilt one feature at a time. The purpose is **not to document what exists**. It is to unlock the best flow and the best screens for each area, so users have a smooth, clear, low-effort experience. For each flow the owner wants one page that shows the whole journey with every screen in order, so (1) the client can approve it, and (2) the later build has a single, complete list of screens.

**Existing screens and existing code are starting points, not limits.** Some of this flow may already be designed in Paper and built in code. If your better design differs from what exists, that is fine and expected: the owner will change or delete and re-implement the code to match the approved design. So do not preserve a screen, a step or a field just because it exists. Keep it only if it is the best answer. You may look at the earlier screens, the plan documents and the code for context and to learn the business rules, but do not let them cap your thinking.

A finished example of the **format** exists: the **Purchasing walkthrough** (page `13 · Purchasing walkthrough (client)`, id `p-O-0`, in the V3-RMS file). Study it first. The owner likes how it reads and wants every flow to feel the same. The Purchasing flow was itself improved during design (for example one order per supplier, advance payments, PIN signatures, and a full mistake-fixing chapter), which is the kind of improvement wanted here.

## Read first

1. `CLAUDE.md` (project rules; you only do design here).
2. Load the Paper guide before any Paper tool: `get_guide({ topic: "paper-mcp-instructions" })`. For phone screens also `get_guide({ topic: "mobile-status-bar" })`. Call `get_font_family_info` for Geist and Geist Mono before typography work.
3. `docs/features/inventory/purchasing-walkthrough-handoff.md` (the brief that produced the Purchasing walkthrough; copy its way of working).
4. For your flow only: its plan in `docs/features/inventory/milestone-N-plan.md`, its sessions folder, and the rows for it in `02-screens-by-role.md`. Read only the sections for your flow; do not read whole documents. Use them to learn the **business rules and the people involved**, not as a design you must keep.
5. Optionally look at the built behaviour in `frontend/features/<feature>/` (read-only) to see how it works today and what real users have been given. Treat it as evidence of problems and good ideas, not as a constraint.

## The Paper files

- **Working file:** "V3-RMS", id `01M1ZZJ6S3FZGF5C7PPBGTKY89`. Always pass this `fileId`. Do all design here.
- **Clean file for approved designs:** "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. It has the design tokens and one page per flow, named "Inventory · Purchasing", "Inventory · Prep", "Inventory · Requisition and dispatch" and "Inventory · Counting and closing" (the Purchasing page is done and is the template for yours). **Do not write to it.** Paper tools cannot copy between files. When the flow is approved, tell the owner exactly which artboards to select and copy into the matching page of the clean file; the owner pastes them by hand.
- Create a **new page** in V3-RMS for your walkthrough, named `14 · <Flow> walkthrough (client)` (use the next free number).
- Design system tokens live in the file. Use CSS variables, for example `var(--color-ink)`, `var(--color-primary)`, `var(--color-border)`. Fonts: Geist and Geist Mono only; signatures in Alex Brush.

### Flows and where their screens live in V3-RMS

| Flow | Where the existing screens are | Status |
|---|---|---|
| Prep | `p-D-0` "04 · M3 Prep" | Built (M3) |
| Requisition and branch approval | `p-E-0` "05 · M4 Requisition & Branch approval", phone screens also on `p-J-0` | Built (M4) |
| Dispatch and branch receiving | `p-F-0` "06 · M5 Dispatch & Branch receiving" | Built (M5) |
| Counting, closing and discrepancies | `p-G-0` "07 · M6 Counting, Closing & Discrepancies" | Built (M6 S1-S4); two owner decisions still open, do not decide them |
| Catalog, suppliers, restock levels | `B-0` "02 · M1 ...", `p-M-0` "11 · Suppliers expansion" | Built (M1) |
| Purchasing, receiving, supplier AP | done: `p-O-0` | Done |

Pages with "98 · Designed, not built" and "99 · ARCHIVE" in the name are not sources. Ignore the archive pages.

## How to work

1. **Understand the flow as it works today.** `get_basic_info` on your source page(s), take screenshots, read the plan, and learn who does what, where, on which device and why.
2. **Send the owner a flow brief and wait.** Before drawing anything, send a brief in plain, short, well-formatted language with these parts:
   - **How the flow works today:** a simple numbered outline per role, in plain words.
   - **What is weak about it:** the problems you see from the user's point of view. Think about the person at the moment of use (for example a cook at a prep station with wet hands, an attendant at the dock with a delivery waiting, a manager reviewing many items quickly). Look for extra taps, unclear next steps, hidden state, duplicated entry, wrong device, slow checks, easy mistakes, and missing undo.
   - **How you would redesign it:** the proposed flow in story order, with chapters. For every change say **what changes, and why it is better for the user**. A table of "today / proposed / why" works well.
   - **Screens:** which would be kept as they are, which improved, which new, which removed.
   - **Open questions** for the owner. Ask them here, not mid-build.
   Do not start drawing until the owner replies and approves the direction.
3. **Build the walkthrough page** (format below), improving the screens as you agreed. Design the improved screens properly. Do not simply copy the old ones.
4. **Check it.** Take a screenshot after each group of changes and fix problems with targeted edits. Look at every artboard before you report.
5. **Report in plain language** (see the last section).

### What "better" means here

Aim for fewer steps, one clear next action per screen, the right device for each role, big touch targets where people are busy, status that is always visible, sensible defaults, no re-typing of what the system already knows, and mistakes that are hard to make and easy to fix. Challenge every field and every screen: if a user would not miss it, remove it. Where two good options exist, recommend one and say why.

## Walkthrough format (match the Purchasing walkthrough)

- **Cover** artboard: title, one-line story, the roles involved, the stage strip if the flow has stages.
- **Chapters in story order**, one artboard per chapter: a small header (CHAPTER n OF N · ROLE and a title), then a row of steps separated by 120px arrow frames. Large flows may use two rows.
- **Each step** = a caption plus the screen. Caption is minimal: `STEP n` (mono), a neutral role chip, and a 3 to 6 word title. No long explanations on the page.
- **Drawers and dialogs are steps of their own**, drawn open over a dimmed copy of the screen that opens them (drawer 460px wide, dim `rgba(23,21,18,0.45)`). Keep drawer contents unchanged from the source.
- **Use one running example** with the same names and numbers on every screen of the flow. Check the numbers across screens before you report; fix mismatches.
- Show a **stage tracker or status** on every screen that changes the state of something, if the flow has stages.
- **Printed or shared documents** (if the flow has any) use the approved "Classic ledger" style: white A4, thin navy bar at the top, black text, blue only for the bar and rules, hairline tables, a double-rule total, signatures as the signer's name in Alex Brush above a line, a QR placeholder, and the footer "Generated by Wendo RMS · Designed and developed by Lobster Technologies · lobstertechnologies.co.ke · +254 113 176 613". Copy the printed LPO on the Purchasing walkthrough page rather than redrawing it.
- **A final chapter "When things go wrong"**: the mistakes a user can make in this flow and how they are fixed. Rule used on Purchasing: nothing is deleted; mistakes are fixed by a new linked entry with a reason (cancel, void, reverse); money or stock moves only after a confirm summary; warnings appear before duplicates and overpayment; every fix is logged. Reuse screens where they exist and draw only what is missing.
- **Phone versions**: draw phone screens only for roles that work on a phone (for example attendants and department heads). For desktop roles, desktop only; their phone versions come after the build.
- Reuse an existing artboard only where it is already the best answer; move it onto the walkthrough page with `move_nodes`. Where you redesign a screen, build the improved version on the walkthrough page and label the old one on its source page "SUPERSEDED (see walkthrough)". Do not keep two diverging live copies, and do not delete old artboards without asking.

## Standing style rules (the owner chose these; do not reopen)

- **Tables:** no header fill; 10px Geist Mono uppercase header, letter-spacing 0.06em, one 1px ink rule under it; light row dividers. Never use `--color-table-header-bg`.
- **Phone screens:** the top is the espresso `var(--color-sidebar-top)`: a white status bar, then a header block (menu or back arrow, "WENDO RMS · HUB" in `#B98A5E`, avatar circle `#4E2C14`, title 22px white, subtitle `#B5AEA5`).
- **Sidebar:** match the existing sidebar. Copy it from a source screen; do not redraw it.
- **No "phase 1/2/3" language** for Inventory; that iteration was discarded.
- **Loading, empty and error states:** use one reusable states kit and a short per-screen copy table. Do not draw an artboard for every state of every screen.
- **Paired live/historical screens:** keep the same layout by default. Ask before optimizing one of them separately.
- **Visual accuracy:** check each artboard visually against its source during the build. Do not use automated pixel-diffing.

## Rules for working with the owner

- Answer in plain, short, well-formatted language. Lead with the answer.
- **Never show node ids to the owner.** Refer to screens by name.
- Verify before claiming. If you say something is built, wrong or missing, check it in Paper or in the code first.
- Do not decide open owner decisions. List them and ask.
- Do not delete or overwrite artboards on pages you did not create without asking.
- Call `finish_working_on_nodes` after every batch of edits. Take screenshots after groups.
- Do not push, commit or run migrations. This session writes nothing in the repo except the decisions file below.

## Paper tool tips (learned on Purchasing)

- `write_html` supports flex layout only: no margin, grid or tables. Set `layer-name` on frames. Use `insert-children` to add, `replace` to rewrite a node.
- `<x-paper-clone>` is lossy for large screens (breaks wrapped or absolute text). Prefer `move_nodes` or `duplicate_nodes`; `duplicate_nodes` returns a very long id map, so do not duplicate whole chapters repeatedly.
- `position: absolute` is ignored for flex children of flex parents; it works inside an "overlay" frame (a frame with `position: relative` and clipped overflow).
- `update_styles` sets `left` and `top` on artboards. `find_nodes` with `textValue` and wildcards finds text; scope it with `nodeId`.
- Export screens as PNG with `export`: `nodes` maps an id to `[{ "format": "png", "scale": "2x" }]`. The files land in the Downloads folder.

## Finish

1. Write a short **decisions file**: `docs/features/inventory/<flow>-walkthrough-decisions.md` with the rules settled in this session (who can do what, what happens in each state, how mistakes are fixed), the running example, and open questions. Write it in plain language.
2. Tell the owner: the page name; the chapter list and number of steps; the improvements you made compared with the old flow and why; **what would need to change in the built code** (a short plain list, for example "the requisition now needs a second approval screen", so the owner can plan it; do not edit code); open questions; and exactly which artboards to copy into which page of the clean file.
3. Stop. If the owner approves, they may ask for a PowerPoint (22 or so slides, full screens with no callouts, white background, navy and blue, a six-stage progress strip, a hidden appendix, short speaker notes). Do not build it unless asked.
