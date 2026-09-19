# Design completion session — Inventory Milestone Two (Receiving & Supplier AP)

Paste everything below the line to the agent running this session. This is a
**Paper design session**, not a build session — no backend/frontend code
changes, no Step 5 planning. Stop when the screens described below exist and
are reviewable; do not proceed to Step 5 (`docs/FEATURE_REDO_PLAYBOOK.md` §5)
even if it seems like the natural next step.

---

You are completing the Paper design for **Inventory Milestone Two — Receiving
& Supplier AP**, before Step 5 (high-level plan) can start. The owner reviewed
the milestone's screen set on its dedicated Paper page and found two real
gaps: **no mobile version exists for 7 of the 10 screens**, and **the
Purchasing hub has no loading/error states** while comparable screens
(Suppliers list, Goods Receipt detail) do. Both are now owner-confirmed scope,
not open questions — your job is to design them, not to re-litigate whether
they're needed.

## Where to work

**Paper file:** `V3-RMS` (`01M1ZZJ6S3FZGF5C7PPBGTKY89`).
**Page:** `Milestone Two · Receiving & Supplier AP` (page id `C-0`) — the
reviewable set the owner already approved the desktop layout of. Add new
artboards to this page, following its existing numbered-column convention (10
desktop artboards in workflow order, each renamed `N · Screen name · surface`,
grouped under two LABEL bars: "1–5 Buying & Receiving" and "6–10 Supplier
AP"). Do not create a new page for this — extend the existing one.

**Source pages for reference** (read these, don't edit them): page `3-0`
("Inventory — Feature 1") holds the original Store Manager screens (page-4
equivalent artboards `3JM-0`, `4D9-0`, `4LD-0`, `4UM-0`, `5GE-0`, `6IJ-0`,
`6TF-0`) and the Attendant screens on page `5-0` (`HLM-0`/`HPB-0` for the
Receiving worklist, `898-0`/`8RJ-0` for New Goods Receipt — already
mobile-designed, used as direct precedent for what "this screen, but mobile"
should look like for the rest).

**Read first, in this order:**
1. `docs/features/inventory/MILESTONES.md` — confirms Milestone Two's scope
   and why these 10 screens are grouped together.
2. `docs/features/inventory/02-screens-by-role.md` §"1 · Store Manager
   (desktop)" rows 1–10 and §"2 · Store Attendant" — the current
   DESIGNED/MISSING status per screen (you're closing gaps this doc will need
   updating to reflect once you're done — see "When you're done" below).
   **Read the note at line ~99–101 ("O-SM1")** — it documents the *prior*
   doctrine (Store Manager is desktop-primary, no SM-specific mobile
   artboards planned) that this session **deliberately overrides** per the
   owner's 2026-09-15 decision. Don't "fix" this by reverting to the old
   doctrine; update the doc to reflect the override instead.
3. `docs/DESIGN_SYSTEM.md` — tokens, primitives, the mobile-status-bar
   convention (call `get_guide({ topic: "mobile-status-bar" })` before
   drawing any mobile artboard's status bar — paste it verbatim, don't
   hand-draw one).
4. This file's own two task sections below.

## Task 1 — Mobile versions of all 10 screens

**Already have a mobile version — use as-is, no work needed:**
- New Goods Receipt (mobile `898-0`, cloned onto page `C-0` as `UQE-0`)
- Goods Receipt detail (mobile `8RJ-0`, cloned as `UVN-0`)
- Receiving worklist has a mobile artboard on the source page (`HPB-0`) that
  was **not yet cloned onto page `C-0`** — the desktop clone (`UMS-0`) is
  there but its mobile counterpart is missing from this page. **Clone
  `HPB-0` onto page `C-0`** (matching the existing artboard-naming and
  positioning convention — see Milestone One's page `B-0` for how desktop +
  mobile rows are laid out, a "LABEL · Mobile versions" bar above a row of
  390px-wide artboards) before designing anything new. This one is a clone,
  not new design work.

**Need new mobile design — none exist yet, on any page:**
- Purchasing hub
- New purchase (drawer)
- Record supplier invoice (drawer)
- Record supplier payment (drawer)
- Suppliers / AP landing
- Supplier detail
- New/edit supplier (drawer)

For each of these 7, design a mobile (390px) equivalent. Use the same content
and behavior as the desktop version (source artboards are on page `3-0` — see
IDs above) — this is a **responsive adaptation**, not a redesign. Follow
patterns already established elsewhere in this file for the same job:
- A **hub-landing route** (Purchasing hub, Suppliers/AP landing) → look at how
  the Attendant's Central Store dashboard or Stock & counts hub collapsed to
  mobile (`HIB-0`, `IBL-0` on page `5-0`) — KPI strip becomes a horizontal
  scroll or stacked card, bands stack vertically, table becomes a card list
  (see Milestone One's `TLT-0` Item Catalog mobile for the "table → card list"
  transform already used once in this same file).
- A **detail route with panels** (Supplier detail) → stack the profile block,
  the "What we owe" panel, and Purchase history vertically as full-width
  sections instead of the desktop's two-column layout.
- A **drawer** (New purchase, Record invoice, Record payment, New/edit
  supplier) → on mobile these become **full-screen routes**, not slide-over
  drawers (the drawer pattern doesn't work at 390px) — see how Milestone
  One's drawers (`SKV-0` Item create/edit, `SX5-0` New/edit supplier) became
  full-screen mobile routes (`TLU-0`, `TLW-0`) for the exact transform to
  copy: header becomes a mobile Task Header (Cancel/Done, per
  `04-components.md`'s "Mobile Hub Header + Task Header" composite), body
  scrolls, primary action becomes a fixed bottom bar instead of a drawer
  footer.

Only design the **populated** state per mobile screen unless the desktop
version has a state that changes the mobile layout materially (e.g. New
Purchase's overpayment variant) — per this file's own state policy (universal
loading/empty/error/permission-denied are drawn once, not redrawn per
screen — see `02-screens-by-role.md`'s "State policy" note).

## Task 2 — Purchasing hub loading + error states

The Purchasing hub (`3JM-0` on page `3-0`, cloned as `U7V-0` on page `C-0`)
has only `populated` (`3JM-0`) and `empty` (`3OH-0`) states. Suppliers/AP
landing and Goods Receipt detail — comparable hub/route screens in this same
milestone — both have `loading` and `error` states; the Purchasing hub should
match that standard, not be the one exception.

- **Loading**: follow the same skeleton convention already used for the
  Suppliers list loading state (`5R3-0`) — KPI strip shows dash placeholders,
  table rows become skeleton blocks, real header/toolbar chrome stays.
- **Error**: follow the same convention as Suppliers list error (`63H-0`) or
  Central Store dashboard error (`31Y-0`) — a centered error message in the
  content area, chrome (sidebar, topbar, page header) stays intact.

Add both as new artboards on page `3-0` (next to `3JM-0`/`3OH-0`, following
that row's existing spacing) AND clone them onto page `C-0` alongside the
existing Purchasing hub artboard, same as every other screen on that page.

## Process

- Use TodoWrite and keep it live — this is a multi-artboard session across
  two pages.
- Take a screenshot after each new artboard and self-review against the
  Review Checkpoints in the Paper guide (spacing, alignment, artboard fit)
  before moving to the next one.
- Source every value (colors, spacing, type) from existing tokens/artboards
  in this file — this is an adaptation of already-approved designs, not a
  fresh visual direction. Do not introduce new colors or type scales.
- **Do not touch** any of the terminology/copy changes made in the 2026-09-15
  review session (payment terms are "Invoice" / "Paid on delivery", not
  "Invoice to follow" / "Pay now"; no damaged-goods fields on the Goods
  Receipt table) — carry those into every new mobile screen you draw, don't
  reintroduce the old copy from the desktop source artboards where it might
  still say the old terms.

## When you're done

1. Update `docs/features/inventory/02-screens-by-role.md`: change each of the
   7 screens' Store Manager rows from a desktop-only Device value to
   `desktop + mobile`, and add the new mobile artboard IDs to their Status
   column. Update the "O-SM1" note (around line 99–101) to record that this
   was overridden 2026-09-15 for Milestone Two specifically — don't delete
   the note, since it documents real prior reasoning; append what changed
   and why.
2. Update `docs/features/inventory/MILESTONES.md`'s Milestone Two row if its
   design-status description needs to change (it currently says "DESIGNED —
   all 10 screens exist in Paper," which was true for desktop only — make
   sure the note is accurate once mobile exists too).
3. Do **not** start Step 5 planning. Report back what was designed, any
   judgment calls you made adapting desktop → mobile, and anything you think
   needs the owner's direct review before Step 5 starts (e.g. if a mobile
   layout genuinely can't preserve some desktop behavior 1:1).
