# Inventory Phase 1 — Redesign Plan (Living File)

Phase 1 (Central Store) shipped functionally correct and was verified hands-on
by the owner on 2026-08-20 — see `CLAUDE.md`'s Phase 1 status note. It was
**not** built design-first: most screens were built directly against
`docs/DESIGN_SYSTEM.md` with no Paper/Figma design pass, and the Attendant
mobile screens (Session 6) followed one-off mockups rather than an iterated
design. The owner considers the current screens poorly designed and wants
them redone properly, the same way Phase 2 was — flow by flow, in
Paper.design, before any code changes.

This is **a visual/UX redesign of already-correct functionality, not a
rebuild.** The backend and business logic are not assumed broken. Existing
screens stay live and in production until their flow's redesign is approved
and built — nothing is deleted up front.

**Read `docs/DESIGN_FIRST_WORKFLOW.md` in full before doing any design work
here.** This file is that workflow's Stage 1 (Plan) applied to Phase 1.
Stages 2-4 (design in Paper, derive backend contract, build) follow the same
procedure Phase 2 used — see
`docs/context/INVENTORY-FEATURE/INVENTORY_PHASE2_DESIGN_FIRST_PLAN.md` for
the worked example of what that looks like in practice, and
`docs/context/INVENTORY-FEATURE/PAPER_DESIGN_PATTERNS.md` for canvas/Paper
conventions before opening any flow.

**Design tool: Paper**, not Figma — same tool and file Phase 2 used, so the
Stage 4 code-extraction pipeline (`get_jsx`, `get_computed_styles`,
`get_fill_image`, `get_font_family_info`) stays available. An existing coded
screen can be brought into Paper as a starting reference via `write_html`
before redesigning it, per the workflow doc's Stage 4 note.

---

## The model (first principles)

Central Store is one warehouse serving every branch. A unit of stock has
exactly one life story:

**Buy it → Receive it → (maybe) Prep it → Count/track it while it sits →
Dispatch it out when a branch asks.**

Waste is not its own stage — it's an exception that can occur at any point
above (a delivery arrives spoiled, a prep batch goes wrong, a shelf item
expires).

**Dispatch-out (branch requisitions → Central Store fulfils) is Phase 2's
Flow B, already designed and closed.** Phase 1's redesign scope stops at
"stock sitting in Central Store, ready to be dispatched" — it does not
redesign dispatch itself.

Two roles run everything in scope here:

- **Store Manager** — decides and approves: what to buy and from whom, PO
  send/cancel, AP, count-variance approval, waste review, reports.
- **Store Attendant** — does the physical work: receives deliveries, preps
  items, executes counts (blind), logs waste, checks the shelf.

---

## The flows

Four flows, grouped by the physical/operational journey above, not by role
or by the screen list that happened to get built. Each flow lists its
in-scope screens by role/device and their current state.

### Flow 1 — Buy & Receive
*Manager decides what to buy → orders it → Attendant receives it against the order → the resulting supplier debt is tracked.*

Catalog and Suppliers are reference data this flow runs on (what can be
bought, from whom, at what price) — they live inside this flow, not as their
own flow. Accounts Payable is the financial tail of the same buying decision
(what's now owed as a result of what was received), not a separate concern.

| Screen | Role | Device | Current state |
|---|---|---|---|
| Item Catalog (CRUD) | Store Manager | Desktop + Mobile | Built, no design pass |
| Suppliers + Items & Pricing | Store Manager | Desktop + Mobile | Built, no design pass |
| Purchase Orders — list / new draft | Store Attendant | Mobile | Built from mockup (Session 6) |
| Purchase Orders — list / new / detail / send / cancel | Store Manager | Desktop + Mobile | Built, no design pass |
| Receiving — list + execution (discrepancy highlight) | Store Attendant | Mobile | Built from mockup (Session 6) |
| Receiving — inline in PO detail panel | Store Manager | Desktop + Mobile | Built, no design pass |
| Accounts Payable (invoice list, record invoice/payment) | Store Manager | Desktop + Mobile | Built, no design pass (tab inside Suppliers screen) |

### Flow 2 — Prep
*Attendant preps raw stock into prepped stock and logs exactly what happened; Manager sees the resulting cost.*

No recipe concept — Prep Recipe was scoped, then explicitly dropped and
never built or used (Session 7/8). Do not reintroduce it in the redesign;
Prep stays a pure actuals log: output item, inputs consumed, actual yield.

| Screen | Role | Device | Current state |
|---|---|---|---|
| Prep entry (output → inputs → yield) | Store Attendant | Mobile | Built from mockup (Session 6) |
| Prep entry + running cost panel | Store Manager | Desktop | Built, no design pass |
| Prep entry (same flow as Attendant, no cost panel) | Store Manager | Mobile | Built, no design pass |

### Flow 3 — Count & Waste
*Keeping the stock record honest: physical counts reconcile what's actually there, waste logging captures loss whenever it happens.*

Grouped together because both are the same underlying job — reconciling the
system's number against reality — not because they share a screen today.

| Screen | Role | Device | Current state |
|---|---|---|---|
| Stock Count execution (blind — no expected qty) | Store Attendant | Mobile | Built from mockup (Session 6) |
| Stock Count session creation + variance approval | Store Manager | Desktop | Built, no design pass |
| Stock Count variance approval (compact) | Store Manager | Mobile | Built, no design pass |
| Waste Log entry (3-tap: item, qty, reason) | Store Attendant + Store Manager | Mobile | Built from mockup (Session 6), Manager reuses unchanged |
| Waste Log review (filterable table) | Store Manager | Desktop | Built, no design pass |

### Flow 4 — Stock Visibility
*What's on the shelf right now, and over time, for whoever needs to look.*

| Screen | Role | Device | Current state |
|---|---|---|---|
| Stock on Hand (read-only card list) | Store Attendant | Mobile | Built from mockup (Session 6) |
| Stock on Hand (ExcelTable + ledger side-panel) | Store Manager | Desktop | Built, no design pass |
| Stock on Hand (tappable cards → movement history) | Store Manager | Mobile | Built, no design pass |
| Dashboard | Store Manager | Desktop + Mobile | Built ad hoc mid-Phase-1, never designed against any reference |
| Reports (7 report types; 3 have full mobile views, 4 are desktop-only stubs) | Store Manager | Desktop (+ partial Mobile) | Built, no design pass |

---

## Open questions to resolve before or during design

1. **Reports' 4 desktop-only reports** (Prep Yield, Count Discrepancy, True
   Cost per Prepped Item, Supplier AP Aging) — redesign keeps them
   desktop-only, or does this pass give them real mobile views? Decide per
   flow when Flow 4 is designed, not up front.
2. Everything else Stage 3 of the workflow will surface once each flow's
   screens are approved — do not pre-guess backend gaps here.

---

## Sequencing

Same rule as Phase 2: **no code starts until a flow's screens are
approved**, but flows don't have to be designed in order and don't block
each other. Suggested order (buy → prep → count/waste → visibility follows
the physical journey, so is a reasonable default): Flow 1 → Flow 2 → Flow 3
→ Flow 4. Adjust freely — this is not a dependency chain, just a suggestion.

Existing screens are not deleted or replaced until their own flow's
redesign is built — this file governs design work only, not a cutover
schedule.

---

## After a flow's screens are approved (Stages 3-4)

Once a given flow's screens are approved in Paper, that flow moves through
the rest of `docs/DESIGN_FIRST_WORKFLOW.md` on its own — it does not wait
for the other three flows.

1. **Audit backend + frontend against the approved design, field by field**
   (Stage 3's contract-derivation step). For every approved screen in the
   flow, write down: what data it displays down to the field, what actions
   it triggers and what each action must persist, and what relationships
   between screens the data implies. Since Phase 1's backend is already
   built and verified correct, this is an **audit against existing
   endpoints/schema**, not a from-scratch contract — the expected outcome
   for most screens is "already returns what's needed." Record findings
   directly in this file, per flow, before touching any code — same as
   Phase 2's Stage 3 section models.
2. **Where the audit finds a real gap** (a field the design needs that no
   endpoint returns, a new action with nothing to persist it), that becomes
   explicit scope for a backend change — call it out, don't silently absorb
   it into the frontend build.
3. **Change the backend** for any gap found (if any). Expect this step to
   be small or empty for most flows, since Phase 1's backend was already
   hands-on verified — the redesign is visual, not functional.
4. **Rebuild the frontend for that flow against the approved design**,
   pulling exact values from Paper (`get_jsx`, `get_computed_styles`,
   `get_fill_image`, `get_font_family_info`) rather than a screenshot,
   per the workflow's Stage 4 rule. This is what "import the design into
   the codebase" means in practice — there is no literal file import step;
   the design is read out of Paper and rebuilt as real React components in
   this codebase's own conventions.
5. **Swap the new build in for the old screen(s)** for that flow once it's
   built and manually verified in-browser (per `CLAUDE.md`'s UI-testing
   rule) — this is the point the old, undesigned screen is actually
   replaced, not before.

---

*Created 2026-08-24. Companion to `docs/DESIGN_FIRST_WORKFLOW.md` (the
general procedure this file applies) and
`docs/context/INVENTORY-FEATURE/INVENTORY_PHASE1_SESSION_PLAN.md` (the
historical record of how these screens were originally built).*
