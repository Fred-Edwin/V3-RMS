# Handover Prompt — Phase 0: Design System Foundation

Paste this into a fresh session to start Phase 0 of the Wendo RMS redo.

---

You are starting **Phase 0** of the Wendo RMS feature-by-feature redo: building
the new design system foundation. Read `docs/FEATURE_REDO_PLAYBOOK.md` in full
before doing anything else — it is the governing process for this and every
feature that follows. Pay particular attention to §3 (design direction) and §4
(Phase 0), which this session executes.

## Your role

Play an **expert enterprise product designer** — the kind who has shipped design
systems for products like Linear, Stripe, or Apple's internal tools. You are
exploring and proposing; the owner (Edwinfred) makes the final calls on taste.

## Context

Wendo RMS is a restaurant management system currently running a "warm" design
system that the owner considers amateurish — overly rounded, weak visual
hierarchy, flows with too many taps per task. It is being replaced with a
premium enterprise design system, then rolled out feature-by-feature (see the
playbook for the full process). This session builds the foundation everything
else is built on. There is no existing screen to preserve compatibility with —
work from a clean slate guided by the brief below.

## Design direction (owner's brief — playbook §3)

- **Premium enterprise product design. Excellence.** Bar: Linear, Stripe, Apple,
  Google.
- **Top-tier visual hierarchy and information density.** Structure components
  the way the Linear team would — dense but legible, everything deliberate.
- **Crisp, not round.** The current roundness reads as amateurish. Sharp or
  minimal radii. Clean lines. Ledger-like.
- **Flows optimised for minimal taps per action** — this mostly matters for
  later feature work, but it should inform navigation patterns you propose now
  (e.g. do NOT propose a bottom nav with a pile of links and a "More" button;
  propose a proper sidebar/navigation pattern that also works on mobile).
- **Restrained creative touches.** A few deliberate, tasteful details that
  signal a designer sat and thought about this — e.g. a subtle, professional
  gradient on a sidebar rather than a flat fill. You are expected to propose
  these and surprise the owner. Not loud, not decorative for its own sake.
- **Color:** wide open — go with what an expert enterprise product designer
  would choose. No hard palette mandate.
- **No hard device constraints** were specified by the owner. Assume standard
  desktop + mobile web use.

## Design tool: Paper

Design happens in **Paper** (paper.design), an HTML/CSS-native design tool with
an MCP server already connected in this environment (`mcp__paper__*` tools).

**Fresh Paper file for this work:**
https://app.paper.design/file/01M1ZZJ6S3FZGF5C7PPBGTKY89/1-0

Before your first Paper action, call `get_guide({ topic: "paper-mcp-instructions" })`
and follow it — it covers session setup, typography rules (call
`get_font_family_info` before first type styling), the write/review/
`finish_working_on_nodes` loop, and how to pull exact values via `get_jsx` /
`get_computed_styles` for later code export. Use `get_basic_info` on the file
first to see what's there (it's fresh — likely empty).

## What to produce (playbook §4.1 — Token exploration)

Explore **2–3 distinct directions** for the foundational design tokens, each as
a real composition in Paper (not just swatches) so the owner can see them in
context — e.g. a small dashboard fragment, a sidebar, a data table, a couple of
buttons/inputs, using real Wendo RMS content (orders, inventory, staff — pick
what best shows the system off). For each direction, cover:

- **Color** — neutral ramp, accent(s), semantic colors (success/warning/error/
  info). Propose what an expert enterprise designer would choose.
- **Typography** — font family (check availability via `get_font_family_info`),
  type scale, weights, line-heights.
- **Spacing scale**
- **Radii** — small/sharp, per the brief.
- **Elevation** — shadows/borders, how depth is communicated.
- **Density** — spacing and sizing defaults for a dense, information-rich UI.
- **One or two restrained creative touches**, called out explicitly (e.g. "the
  sidebar uses a subtle vertical gradient from X to Y").

Give each direction a short name and a one-paragraph rationale tying it back to
the brief. Do not pick a winner — present them side by side for the owner to
choose from, and be ready to iterate.

## After the owner picks a direction (playbook §4.2 – §4.4)

Once the owner approves a direction (they may ask for merges/tweaks across
directions first — iterate until they say it's approved):

1. **Codify the tokens** — CSS variables + Tailwind theme config in the
   `frontend/` app. Rewrite `docs/DESIGN_SYSTEM.md` from scratch around them
   (the old content is already archived at
   `docs/archive/phases/` — do not resurrect it).
2. **Build the base component set on shadcn/ui** — add primitives via the
   shadcn CLI (`npx shadcn@latest add <component>`; do not hand-write them),
   then restyle each onto the new tokens. This becomes the new
   `frontend/components/ui/`. Core set per the playbook: button, input, select,
   combobox, dialog, sheet, drawer, table, data-table, card, badge, tabs, toast,
   dropdown-menu, tooltip, form, checkbox, radio, switch, skeleton, popover,
   command, avatar, separator, scroll-area — plus any app-specific composites
   that came up during the token exploration (e.g. the sidebar nav).
3. **Structure groundwork** — create `backend/src/modules/` and
   `backend/src/shared/` (empty, one README each explaining what goes there per
   playbook §9). Do not move any existing backend code yet.

## Approval gates — do not skip

- The owner **must approve the token direction** before you codify anything.
- Show your work as you go (screenshots via `get_screenshot`, not just
  descriptions) so the owner can react early rather than at the very end.

## Out of scope for this session

- No feature work. This is the foundation only.
- No proof-of-concept rebuild of an existing screen — that step was deliberately
  cut from the plan.
- No backend module migration beyond the two empty scaffold folders.

## When you're done

Update `docs/FEATURE_REDO_PLAYBOOK.md`'s Phase 0 exit criteria status and
`CLAUDE.md`'s "Current Work" section to reflect that Phase 0 is complete and
Feature 1 (Inventory) is next.
