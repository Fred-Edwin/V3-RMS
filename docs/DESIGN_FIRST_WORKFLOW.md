# Design-First Workflow

This is the standing procedure for building any new feature in Wendo RMS.
It formalizes what was already agreed as policy for Phase 2 ("Delivery is
design-first... all screens are designed and iterated in Paper.design before
frontend implementation begins") into a concrete, repeatable sequence — and
extends it with the two open questions that came up while actually doing it
during the Phase 2 Branch Manager screens: **how to group screens for
design**, and **where the backend contract comes from**.

Read this before starting Stage A of any new feature. `CLAUDE.md` links here.

---

## Why design-first

Validated in practice during Phase 2's Branch Manager screen work (2026-08-21),
not just theorized:

- **The owner gets a full outlook of the feature before any code exists.**
  Screens are the unit of progress the owner tracks by — seeing all of them
  designed early gives a real sense of scope and completeness that reading
  code never does.
- **Iteration is cheap in a design tool, expensive in code.** A stats strip
  redesigned three times, a stamp restyled twice, a whole screen merged with
  two others — all took minutes in Paper. The same changes after the screens
  were coded would each have been a real engineering task.
- **Cross-role consistency problems surface early.** Designing the full
  requisition → approval → dispatch → receipt arc together (not one role's
  screens in isolation) is what surfaced the need for a shared
  approve/reject/dispatch/receive document pattern with two independent
  stamps — a design decision that touches three roles and would have been
  expensive to retrofit after each role's screens were built separately.
- **The approved screens are the spec.** Every backend data requirement
  surfaced during Phase 2's design pass (a Value(KES) ledger column, both
  requested and approved quantities preserved, per-line dispatched/received
  quantities, variance flags) was read directly off the approved screens —
  before a line of backend code existed. This is the core justification for
  deriving the API contract from the design (Stage 2 below) rather than
  discovering it while writing frontend code against a live backend.

---

## The four stages

### Stage 1 — Plan

The feature plan (`docs/context/<FEATURE>/`) must, before any design work
starts, list every screen the feature needs, and must group them **by user
flow, not by role**.

**Why by flow, not by role:** a flow is what forces consistency to surface.
Batching "all Branch Manager screens" together risks designing an approval
screen in isolation and only discovering — after the fact — that dispatch and
receipt need the same visual and data pattern. Batching by flow (e.g. "the
full requisition-to-receipt journey") forces that pattern to be designed once,
correctly, the first time, because every role's touchpoint on that journey is
in view together.

Within a flow, note which role each screen belongs to (a screen list is still
useful per-role for build sequencing later — see Stage 4) — but the grouping
that drives the *design* sequence is the flow.

Identify which screens in the plan are load-bearing — the ones that decide
whether the feature actually gets used (Phase 2's "the five screens that
decide Phase 2" is the model for this). Design and iterate those hardest;
treat the rest as supporting cast.

### Stage 2 — Design (Paper.design)

Every screen from the plan is designed and iterated in Paper.design, flow by
flow, until the owner explicitly approves it. Ground every screen in real
reference material where it exists (client photos, existing component kit,
prior approved screens) — never design from assumption when a reference is
available.

**No code starts until a flow's screens are approved.** This is the actual
gate, not a suggestion. A flow can proceed to Stage 3 once its own screens are
approved — later flows don't need to wait, but a given flow's build must wait
for that flow's design.

**Derive the backend contract from the approved screens before writing any
backend code.** This is a short, explicit step — not something to skip
because it feels obvious. For each approved screen, list:

- What data does it display (down to the field — a status dot needs a status
  field, a stamp needs a resolver's name/role/timestamp, a variance flag
  needs both a dispatched and a received quantity)
- What actions does it trigger, and what does each action need to persist
- What relationships between screens the data implies (e.g. a document
  screen that must remain renderable months later means nothing it depends
  on can be silently overwritten — this is why `requestedQty` and
  `approvedQty` are both permanent fields, not one field mutated in place)

Write this list down as part of the session that will build the backend —
it becomes that session's scope, not a separate document.

### Stage 3 — Backend

Build to the contract derived in Stage 2. This is real engineering work, not
a formality — schema decisions, RBAC, ledger correctness, and edge cases
(partial fulfillment, rejection-and-resubmit, variance) still need full
design of their own. The screens tell you *what* the backend must return and
persist; they don't design the backend itself.

### Stage 4 — Frontend

Build against the approved design and the real, now-existing backend — one
pass, built to match both. No mock-data layer, no invented interim data
shape to reconcile later.

**Pull exact values from Paper, never from a screenshot.** Paper's MCP tools
let an agent read a design's real structure and values directly, and this is
how frontend implementation should extract them — never by eyeballing a
screenshot and re-guessing spacing, color, or font size:

- `get_jsx` — component structure to translate into the codebase's own
  conventions (React components, not a literal copy of Paper's output)
- `get_computed_styles` — exact CSS values (spacing, color, radius, type)
  for one or more nodes at once
- `get_fill_image` — any image fill used in the design, as a real asset
- `get_font_family_info` — confirms which font/weight is actually in use

Screenshots are for *verifying* a build matches the design after the fact
(visual QA), never for *sourcing* the values used to build it. This mirrors
Stage 2's own rule that a design must be grounded in real reference material
(client photos, existing components) rather than assumption — the frontend
build must be grounded in the design's real values, not an approximation of
them.

The same channel works in reverse: an existing coded screen can be brought
into Paper (via `write_html`, or Figma-imported designs via the
`figma-import` guide topic) when a redesign needs to start from what's
already shipped rather than from a blank artboard.

**Why not build a clickable frontend against mock data first:** it was
considered and deliberately rejected. A frontend with no real backend
contract has to invent one as it goes (component props, response shapes,
what "success" looks like) — and an invented shape frequently doesn't match
what the backend actually needs to return, especially for real business
rules like the dual-org dispatch bridge or two-stamp variance logic. That
produces two independently-invented shapes to reconcile instead of one
target to build to. The same risk that makes "design-first, not code-first"
correct also makes "contract-first, not mock-first" correct — both exist to
avoid inventing structure that has to be un-invented later.

---

## Quick reference

```
PLAN                DESIGN                    BUILD
────                ──────                    ─────
List every    →      Design & iterate    →     Derive backend contract
screen, grouped      in Paper.design,          from approved screens
by flow, noting      flow by flow, until       (explicit, written step)
role per screen      owner approves                    │
                            │                           ▼
                     No code starts             Backend, to that contract
                     until a flow's                     │
                     screens are approved              ▼
                                              Frontend, against approved
                                              design + real backend,
                                              one pass
```

---

*Created 2026-08-21, formalizing the design-first principle already agreed
for Phase 2 (see `docs/context/INVENTORY-FEATURE/INVENTORY_PHASE2_SESSION_PLAN.md`)
after the Branch Manager screens (Branch Stock, Branch Stock History, the
Requisition/Dispatch document pattern) were designed, iterated, and approved
entirely in Paper.design before any Phase 2 frontend code existed.*
