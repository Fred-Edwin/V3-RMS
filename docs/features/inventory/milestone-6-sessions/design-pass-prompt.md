# Milestone Six — Paper design pass (pre-build) — session prompt

Paste everything below the line into a fresh Claude Code session.

---

You are the design lead on Wendo RMS, a multi-tenant restaurant management
system being rebuilt feature by feature. Inventory & Procurement is Feature 1;
Milestones One–Five have shipped. **Milestone Six (Counting, Closing &
Discrepancies)** has an owner-approved screen set in Paper. A planning review
on 2026-09-24 found gaps that must be fixed in Paper **before** any code is
written, because every build session checks its screens against these
artboards by eye. Your job this session is **design only — no code.**

## Read first (only the sections named)

1. `CLAUDE.md` — project briefing.
2. `docs/features/inventory/milestone-6-plan.md` — **§0 (scope table), §1.8
   (reason enums), §1.9 (thresholds), §7 (decisions + findings Q-A…Q-E).**
   This is the approved plan; your artboards must agree with it.
3. `docs/DESIGN_SYSTEM.md` — skim the token and component sections you touch.
4. `docs/features/inventory/02-flows.md` — Flows 4, 5, 12, 12b, 12c only, if
   you need behaviour context for a state.

Load the Paper MCP guide once: `get_guide({ topic: "paper-mcp-instructions" })`.

## Where

File `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page **`p-G-0`** ("Milestone Six ·
Counting, Closing & Discrepancies"). The canvas is organised in role bands
(Store Attendant, Store Manager, Branch Manager, Department Head,
Multi-scope/shared), desktop row above mobile row. Place new artboards in the
right band next to the screen they belong to; keep the band layout tidy.

## Standing rules (non-negotiable)

- **Layout consistency beats optimisation.** A new state mirrors its sibling
  artboard exactly: duplicate the existing artboard (`duplicate_nodes`) and
  change only what the state requires. Never redesign a screen while adding a
  state. If you think a layout should change, ask the owner first.
- **Use existing tokens and patterns only.** Pull exact values with
  `get_jsx` / `get_computed_styles` from a reference artboard; never
  approximate from a screenshot.
- **Hairlines:** dark `neutral-800` for structural boundaries (rail/pane
  split, KPI dividers, table header underline, selected-row accent); light
  `var(--color-border)` / `neutral-200` for row dividers inside a list.
- **Primary actions:** `bg-wds-gradient-primary` + `shadow-wds-sheen`
  treatment, as on existing artboards.
- **Desktop sidebar sub-links** use the curved connector-rail pattern —
  reference node `1BI5-0` (inside `1AYX-0`).
- Screenshot and review every artboard you create or change (Paper guide's
  review checkpoints). Call `finish_working_on_nodes` when done with each.
- Don't delete approved artboards. Modify in place, or duplicate for a new
  state.
- Name every new artboard in the existing convention:
  `<screen #> · <screen name> · <role> <device> · <state>`.

## Part A — Fix the gaps (in this order)

| # | Artboard(s) | Fix |
|---|---|---|
| A1 | `188X-0` Attendant mobile hub | **Blind-count leak (plan §7 Q-A).** Remove every on-hand quantity from the Attendant's view: drop the Low stock / Negative cards, the "On hand" list, and "tap a row for its ledger". Keep the three action buttons, the Today's count card, and the Waste — last 7 days list. Use the freed space sensibly, but stay within the existing visual language |
| A2 | `1BX0-0` / `18VZ-0` Log waste | The "On hand −4 kg · current cost KES 90 / kg" hint: add a note on the artboard (outside the frame, or in its name) that the Attendant variant shows **cost only**. No separate artboard needed |
| A3 | `1C47-0` (mobile verify), `181V-0` (desktop verify), `1BC1-0` / `1C8Y-0` (spot count), `19C8-0` / `1CFK-0` (branch dept detail) | **Unify the reason control** (plan §1.8, §7 #3): one select with preset options + "Other (describe)" which reveals a short text input. Central Store options: Suspected miscount · Unlogged spoilage · Suspected loss · Within normal range · Other. Branch options: Consumption · Unlogged waste · Walk-in comp · Suspected loss · Other. Show one artboard somewhere with the select **open** and one with **Other** chosen (text input visible) |
| A4 | `1CMM-0`, `1D2G-0` (history detail) | Reasons on a **closed** day render **read-only** (plain text in the reason style), not as dropdowns |
| A5 | `1CFK-0`, `1D2G-0` (mobile kitchen detail) | Beef patty row: the column label reads "24 PCS" — fix it to EXPECTED / COUNTED, and match desktop's numbers (expected 24 pcs, counted 17 pcs, gap −7) |
| A6 | `18P9-0` (count submitted) | Status bar is drawn **below** the header — fix the order to match every other mobile artboard |
| A7 | `18MQ-0` (count PIN sheet) | Info strip text overflows its box — wrap it |
| A8 | `1AYW-0`, `1B5U-0`, `181V-0`, `18GE-0`, `1BC1-0`, `18VZ-0`, `18ZV-0`, `197U-0` (all Stock & counts desktop pages) | **Consistency:** (a) the Stock & counts sub-link submenu (`1BI5-0`) appears on every page, with the correct sub-link active; (b) KPI labels use the same type style on every page (take `181V-0`'s); (c) the verify rail is the same width on `181V-0` and `18GE-0` (take `181V-0`'s); (d) top-bar actions are the same set on every Stock & counts page (Restock levels · Log waste · Spot count) |
| A9 | `197U-0` (ledger) | Remove the "Viewing as: Store Manager" control. It is not a real feature |
| A10 | `18KU-0` (daily count) | Tabs become **top-level categories** (Dairy / Dry goods / Produce / …, matching the All-items chips), not storage areas. Same for any "· Cold room" row subtitles on hub/all-items rows: show the category |
| A11 | `1BN0-0`, `1CB2-0` (history list) | Remove the "9 Sep · Never closed — flagged to Director / Not closed" row. The owner has ruled that feature out. Statuses shown: Closed · Reopened once/twice · Open |

## Part B — New states (duplicate the sibling, change only what's needed)

| # | Based on | New state |
|---|---|---|
| B1 | `19C8-0` + `1CFK-0` | **Today's day · count entry** — the Branch Manager types counts. The Counted column becomes number inputs (one focused, a few filled, a few empty); Gap column fills in as counts are typed; a reason select appears only on lines whose gap is above threshold. Department rail shows that department as "counting". Desktop + mobile |
| B2 | `19C8-0` + `1CDC-0` | **Today's day · ready to close** — all 5 departments counted, none blocked, **Sign & close day** enabled (primary treatment). Desktop + mobile |
| B3 | `19C8-0` + `1CDC-0` | **Today's day · closed** — status "Closed" badge, counts read-only, a **"Reopen day"** secondary action (this is the missing entry point for `19PY-0` / `1BYP-0`), and "View signed document". Desktop + mobile |
| B4 | `1CMM-0` + `1CSZ-0` | Add a **"Reopen day"** secondary action on the history detail too (desktop + mobile), placed consistently with B3 |
| B5 | `1BYP-0` | Mobile Reopen gets its **"Reopen day"** submit button (destructive tone matching `19PY-0`) pinned at the bottom |
| B6 | `181V-0` + `1C47-0` | **Verify · line queried** — one line in the Queried state (with its note), footer primary changes from "Approve & sign" to **"Send back to attendant"**, with a note field for the attendant. Desktop + mobile |
| B7 | `18KU-0` | **Daily count · returned for recount** — Attendant mobile: a banner with the SM's note; only the queried lines are listed for recount; still blind (no expected shown); primary is "Sign & resubmit" |
| B8 | `197U-0` + `1BPY-0` | **Stock ledger · no item selected** — reached from the bare "Stock ledger" sub-link: an item search/picker empty state |

## Part C — Loading, empty and error states (owner decision: drawn, not improvised)

For each screen below, draw the states listed. Rules:
- **Loading** = a skeleton that mirrors the populated layout (same rail,
  KPI strip, table rows as neutral bars). No spinner-only pages. Look at how
  Milestone Three's shipped skeletons read (`frontend/features/inventory/components/skeletons.tsx`)
  and match that visual weight.
- **Empty** = the real reason it's empty, in product copy, plus the next
  action if there is one (e.g. "No counts yet today" + nothing, "No waste
  logged in the last 7 days", "No items match these filters" + Clear filters).
- **Error** = inline error block in the content area (not a full-page
  takeover), plain-language message, **Retry** button. Error-toned per tokens.
- One artboard per state is enough per device. Where a drawer or sheet is
  involved, draw the in-drawer error (e.g. "Couldn't log waste — try again")
  instead of a page-level one.

| Screen | Desktop | Mobile |
|---|---|---|
| Stock & counts hub (`1AYW-0` / `188X-0`) | L, Err | L, Err, Empty (no count yet today + no waste) |
| All items (`1B5U-0` / `1BRS-0`) | L, Empty (no match), Err | L, Empty (no match), Err |
| Stock ledger (`197U-0` / `1BPY-0`) | L, Empty (no movements in range), Err | L, Empty, Err |
| Restock levels (`18ZV-0` / `1BV6-0`) | save error in drawer | L, save error |
| Log waste (`18VZ-0` / `1BX0-0` / `1ACM-0`) | submit error in drawer | submit error (one artboard covers both mobile variants) |
| Daily count (`18KU-0`) | — | L, Err (save failed, with "your counts are kept" copy) |
| Verify (`181V-0` / `1C2H-0`) | L, Empty (nothing to verify) | L, Empty |
| Spot count (`1BC1-0` / `1C8Y-0`) | Empty (no items added yet) | Empty |
| Today's day (`19C8-0` / `1CDC-0`) | L, Err | L, Err |
| Day close history (`1BN0-0` / `1CB2-0`) | L, Empty (no closed days in range), Err | L, Empty, Err |
| History detail (`1CMM-0` / `1CSZ-0`) | L | L |
| Next-morning opening (`1A5R-0`) | — | L (sheet), Err (accept failed) |

## Part D — Hand-off

1. Update **§0 of `docs/features/inventory/milestone-6-plan.md`**: replace
   every "(DP)" marker with the real node IDs you created or changed, and add
   the L/E/Err node IDs per row. Don't change anything else in the plan. If
   a design decision contradicts the plan, stop and ask the owner instead of
   editing the plan's decisions.
2. Update the page guide artboard (`181Q-0`) text so it describes the page
   accurately (artboard count, what was added).
3. Write a short summary for the owner listing each fix (A1–A11), each new
   state (B1–B8), the Part C states drawn, and anything you couldn't resolve.
   The owner approves these artboards before build Session 1 starts.
4. Don't commit anything unless the owner asks. Don't touch application code.
