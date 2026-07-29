# Inventory Phase 1 — UI/UX Design Audit (Not Started)

Agreed with the project owner 2026-07-29, after Phase 1 (Sessions 1-9) and
the Store Roles staff-integration pass both shipped. Everything built so far
was verified for **function** — does the ledger reconcile, does RBAC block
the right roles, does the screen render without errors. Nobody has yet
reviewed it for **look and feel and usability** as a deliberate design pass.
This file is that pass's brief, to be picked up in a fresh session (design
review needs a different mode than "implement and verify," and a fresh
session starts unbiased instead of anchored on implementation-session
decisions).

## What this session is

Claude Code acting as an expert UI/UX designer specializing in premium,
top-tier product design, auditing every Phase 1 screen and flow, then
implementing the fixes. Not a bug hunt (that's what Session 9 already did)
— this is judging whether each screen actually lives up to the product's
own stated design intent, and fixing it where it doesn't.

## Ground truth to read first

1. `CLAUDE.md` — non-negotiables, project structure.
2. `docs/DESIGN_SYSTEM.md` — the actual design system to audit *against*.
   Key principles already stated there, don't relitigate: warmth over
   sterility (cream-undertone white, amber-not-blue greys), the primary
   espresso brown used only where action is required (not decoration),
   Cormorant serif reserved for titles/brand moments, Inter for daily work,
   the "office idiom" (ExcelTable/Sheet, gridlines, tabular numerals) for
   data-dense screens, warm crema (`#F5F0E8`) as the page canvas everywhere
   including back-office screens.
3. `docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` §8 (Roles &
   Screens) — the authoritative screen list and desktop/mobile layout intent
   per screen, to check fidelity against.
4. `docs/context/INVENTORY-FEATURE/MANUAL_TESTING_GUIDE.md` — **use this as
   the audit's own walking order.** It's organized by user flow, not by
   screen in isolation, and that's deliberate: judge each screen in the
   context of the journey a real user is actually on, not cold. The flows,
   in order:
   1. The catalog & suppliers (setup)
   2. Raise, send & receive a PO
   3. Prep entry & the rolling average
   4. Stock counting
   5. Waste logging
   6. Supplier AP
   7. Reports
5. `docs/context/INVENTORY-FEATURE/INVENTORY_PHASE1_SESSION_PLAN.md` — read
   Sessions 6-8's "As Built" sections for context on screens that were
   explicitly **not** mockup-driven (Session 7 was redirected mid-session to
   "design freely against the design system" rather than follow generated
   mockups) — these are more likely to have drift worth auditing than the
   mockup-driven Session 6 Attendant screens. Also note known, deliberate
   v1 cuts that are NOT audit findings: CSV-only export (no PDF), 4 of 7
   mobile reports deferred to desktop-only, no Prep Recipe editor.

## Process (agreed with the project owner — follow this shape)

1. **Owner brings their mistakes list first**, before the audit starts. Not
   after — if the designer's own findings come first, the owner's list ends
   up anchored on what was already found instead of surfacing independently.
   Fold the owner's items in as confirmed findings per screen, then keep
   auditing everything else independently.
2. **Live, interactive walkthrough — not a written report reviewed cold.**
   Pull up each screen live (both shells/roles where applicable), talk
   through it as an expert critique (hierarchy, spacing, color use,
   consistency with `DESIGN_SYSTEM.md`, interaction quality), the owner
   reacts in real time, agree on a fix list together.
3. **Work one flow at a time, per the Manual Testing Guide's order.** Within
   a flow, audit every screen the flow touches (both roles/shells) before
   fixing anything — judge the whole flow's coherence, not just one screen.
4. **Fix screen-by-screen once a flow's issues are agreed** — implement,
   verify live (both shells/roles for that screen), before moving to the
   next screen in the flow. Don't batch fixes across screens or defer
   verification to the end of the flow.
5. **Log decisions in this file as you go** — not a report to read cold
   after the fact, but a running record so nothing gets lost and a future
   session can see what was decided and why. Use the template below, one
   section per flow.
6. **Include UX/flow issues, not just visual ones** — explicitly agreed
   scope. A cluttered layout IS a usability problem; an interaction that
   takes 3 taps when it could take 1 is in scope even if every color and
   spacing choice is already correct. Don't artificially split "looks" from
   "works" — judge both together per screen.
7. **At the end of each flow**, verify per this project's standard
   convention: `npx tsc --noEmit` + `npx next build` clean (frontend only —
   this pass shouldn't need backend changes), live Playwright pass both
   shells/roles for every screen touched in that flow.

## Status

| Flow | Status |
|---|---|
| 1. Catalog & Suppliers | Not started |
| 2. PO raise → send → receive | Not started |
| 3. Prep entry | Not started |
| 4. Stock counting | Not started |
| 5. Waste logging | Not started |
| 6. Supplier AP | Not started |
| 7. Reports | Not started |

## Owner's mistakes list

*(Not yet collected — ask for this first, before starting Flow 1. Was
intentionally deferred to the fresh session rather than captured in the
handoff, so it comes through directly rather than summarized secondhand.)*

## Findings & decisions log

*(Fill in per flow as the audit proceeds. Suggested shape per flow:)*

```
### Flow N — <name>

**Screens covered:** <list, with role/shell>

**Findings:**
- <screen> — <issue> → <agreed fix, or "not fixing: <reason>">

**Verification:** tsc / build / Playwright result, date
```

---

*Created 2026-07-29, handed off from the session that completed Phase 1
Session 9 (integration pass) and the Store Roles staff-integration pass.
Companion to `INVENTORY_FEATURE_PLAN.md` (the feature spec) and
`INVENTORY_PHASE1_SESSION_PLAN.md` (the build session log) — this file is
the design-review pass only, scoped after both of those were already
functionally complete.*
