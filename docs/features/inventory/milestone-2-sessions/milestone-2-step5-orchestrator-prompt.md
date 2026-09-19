# Step 5 orchestrator session — Milestone Two (Receiving & Supplier AP)

Paste everything below the line to the agent starting the Step 5 planning
session for Inventory Milestone Two.

---

You are running **Step 5 — High-level plan** of the Feature Redo Playbook
(`docs/FEATURE_REDO_PLAYBOOK.md` §5) for the Inventory feature, scoped to
**Milestone Two: Receiving & Supplier AP** (Stage 1 Buying/estimate, Stage 2
Receiving, Stage 10 Supplier payment — see `docs/features/inventory/
MILESTONES.md` for why these three stages are one ship unit).

Your job this session is to **produce a plan for owner approval — not to
write backend or frontend feature code.** Stop once the plan doc and contract
types exist; do not start Step 7 build sessions.

## What's already done (read, don't redo)

Steps 1–4 of the playbook are complete and approved for this milestone:

- `docs/features/inventory/01-description.md` — read Stage 1 ("Buying"),
  Stage 2 ("Receiving at the Central Store"), and Stage 10 ("Supplier
  payment"). §7's removals list matters directly here: purchase orders and
  direct market purchase are both explicitly retired, not carried forward.
- `docs/features/inventory/02-flows.md` — Flows 1, 2, 2a, 2b, 2c, 14, 15
  (the buying → receiving → invoice → payment chain).
- `docs/features/inventory/02-screens-by-role.md` — Store Manager screens
  2–10 (Purchasing hub through New/edit supplier) — status column now reads
  `DESIGNED` for all of them, desktop **and** mobile, as of the 2026-09-15
  design-completion session (see that session's own doc,
  `06-sessions/milestone-2-design-completion-prompt.md`, for what changed and
  why).
- The Paper design itself — see "The screen walkthrough" below. This is not
  optional background reading; it is the primary input to this session's
  plan and you should expect to spend real time in it, not skim it once.
- **Gap, unlike Milestone One:** `docs/features/inventory/04-components.md`
  has **no Milestone Two section**. Milestone One's Step 5 session could plan
  against an already-verified component inventory (pixel-diffed, committed).
  That doesn't exist here. Decide explicitly in your plan whether building
  that component inventory is part of this session's output, a named Step-7
  prerequisite session, or folded into the first Step-7 frontend session —
  don't silently assume one of these and leave it unstated. One piece of it
  is already tracked: `04-components.md`'s "Not yet built" table has a
  **Mobile Universal States** composite (`X7O-0`) waiting on the first Step 7
  session that ships a mobile screen needing a real empty/loading/error
  state — fold that into whichever session breakdown item ends up owning
  Milestone Two's mobile build, don't let it get lost as a separate
  untracked task.
- `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` — the D-15 hub-org scoping
  rule. Non-negotiable, same as every other inventory milestone.

Also read, in this order, before planning anything:
1. `docs/FEATURE_REDO_PLAYBOOK.md` §5 (Step 5, your own job description) and
   §7 (production data rules)
2. `docs/DATA_MODEL.md`
3. `docs/API_CONTRACT.md` — existing conventions/format to match (response
   envelope, error codes, role-permission key — §1)
4. `docs/CODING_STANDARDS.md`, `docs/TDD.md`

## The screen walkthrough — this is how you derive the plan, not a reading task

**Do this before you write a single line of schema or contract.** The data
model, API contract, and session breakdown in "What your plan must produce"
below are not a separate design exercise — they are what falls out of this
walkthrough. If a table or endpoint in your plan can't be traced back to a
specific screen and field, that's a sign you invented it rather than derived
it, and you should go back and check.

**Where:** Paper file `V3-RMS` (`01M1ZZJ6S3FZGF5C7PPBGTKY89`), page
`Milestone Two · Receiving & Supplier AP` (`C-0`). Go through all 10 screens
in their workflow order (the page's own numbering, grouped under "1–5 Buying
& Receiving" and "6–10 Supplier AP"), and both surfaces where they exist —
desktop and the mobile adaptations added 2026-09-15 — plus the loading/empty/
error states (Purchasing hub's `W4V-0`/`WBP-0` on page `3-0`, the mobile
universal-states shell `X7O-0` also on page `3-0`).

**For every screen, extract three things and write them down before moving
to the next one:**

1. **Every field or value shown** → each implies either a stored column or a
   computed/derived value (and if derived, derived from what — say so, don't
   just list it as a column). Example: Purchasing hub's "OWED (AP)" KPI is
   not a column anywhere; it's a sum over unpaid/partially-paid invoices.
2. **Every action a user can take** — a button, a toggle, a drawer submit, a
   filter — implies an endpoint, and that endpoint's request/response shape,
   auth role, and error cases. Example: the "Record as billed — open
   dispute" button in the mismatch callout on Record supplier invoice is a
   distinct write path from the plain "Save invoice" button, not the same
   endpoint with a flag — decide which, and say why.
3. **Every state a screen can be in** — empty, the price-alert/mismatch
   callout, the overpayment variant, disputed, partially paid — implies
   either a status enum value the API must expose or a conditional branch
   the contract must model explicitly. These are not just visual states;
   they're business states with real transitions (e.g. `UNPAID` →
   `PARTIALLY_PAID` → `PAID` per `01-description.md` Stage 10 step 3).

**Cross-check as you go.** Numbers and statuses shown on one screen must
reconcile with the same facts shown on another — e.g. the aging buckets on
Suppliers/AP landing, the "What we owe" panel on Supplier detail, and the
"Amount due" field on Record supplier invoice are all views onto the same
underlying AP position. If you find a screen implying a fact that another
screen's data model can't actually produce, that's exactly the kind of
inconsistency to flag under "Questions for the owner" rather than quietly
picking one interpretation.

## The settled schema fact — don't re-derive this, it's already decided

Unlike Milestone One (which had to evaluate an existing Phase 1 schema and
decide keep/extend/replace per table), **this milestone starts from nothing.**
Confirmed by direct inspection:

- Milestone One's migration (`20260915065051_inventory_milestone_one_catalog`)
  **dropped `supplier_invoices`, `supplier_payments`, `purchase_orders` (+
  `purchase_order_lines`), `requisitions`, `dispatches`, `stock_counts`,
  `waste_logs`, `market_purchases`, `prep_recipes`/`prep_records` entirely.**
  Its own plan doc (`milestone-1-plan.md` §1.3) is explicit about
  `SupplierInvoice`/`SupplierPayment`: *"Drop now, replace in their own
  milestone."* This is that milestone.
- **No `GoodsReceipt` model has ever existed**, in Phase 1 or since. Phase 1
  receipted goods against `PurchaseOrder`; the approved design retires
  purchase orders outright (`01-description.md` §7: *"Purchase orders are
  removed entirely"*). The Goods Receipt is a genuinely new model, not a
  rename or an extension of anything in the schema's history.
- What Milestone One did leave behind that this milestone will reference:
  `Supplier` (with `defaultPaymentTerms: SupplierPaymentTerms`), `Category`,
  `InventoryItem`, `RestockLevel`, `InventoryTransaction`. Read their current
  shape directly from `backend/prisma/schema.prisma` — don't assume the
  Phase 1 shapes described in older docs still apply.

Treat this as **greenfield schema design**, informed by the screen
walkthrough above — not a table-by-table audit like Milestone One needed.

## Open question to flag, not silently resolve

`SupplierPaymentTerms` currently has two enum values: `INVOICE_TO_FOLLOW` and
`PAY_NOW` (`backend/prisma/schema.prisma`, plus every occurrence in
`docs/features/inventory/01-description.md`, `02-flows.md`, `02-screens.md`,
`04-components.md`, and the committed backend code/tests/seed script). **The
Paper design drawn in the 2026-09-15 session uses different display copy:
"Invoice" and "Paid on delivery."** No enum or code was renamed to match —
only the Paper artboards changed. Your plan must decide and state: does the
enum itself get renamed (a real migration + a find-and-replace across docs
and code), or does the enum stay as `INVOICE_TO_FOLLOW`/`PAY_NOW` with only
the user-facing label changing at the presentation layer? Either is
defensible — this is the same kind of naming-vs-remodel judgment call
Milestone One's plan made for `PASS_THROUGH` → `STOCKED` (`milestone-1-plan.md`
§1.2, point 2) — but it needs to be made explicitly and justified, not
inferred by whoever builds Step 7 first.

## Production data check

This milestone has no real client data at stake — the tables it's building
(`GoodsReceipt`, `SupplierInvoice`, `SupplierPayment`) don't exist yet in any
form, so there's nothing to migrate *from*. Still confirm, per playbook §7:
list the exact read-only queries needed to verify no receiving/AP-shaped
tables linger under any other name or in an unexpected schema, and ask the
owner to run them and paste results back. This should be a short check, not
the multi-table evaluation Milestone One required.

## What your plan must produce

Output: `docs/features/inventory/milestone-2-plan.md` (per `MILESTONES.md`'s
per-milestone naming convention), plus contract types committed to code
(location per `docs/CODING_STANDARDS.md` / playbook §9). Every item below
should be traceable back to the screen walkthrough — cite the screen/artboard
each decision comes from where it isn't obvious.

1. **Data model** — `GoodsReceipt` + line items, `SupplierInvoice`,
   `SupplierPayment`, and whatever the aging/reconciliation logic needs
   (computed at query time vs. a stored/cached position — your call, state
   the reasoning). Cover the payment-terms branch (Invoice vs. Paid-on-
   delivery) and how it determines whether an AP row is created at all, per
   `01-description.md` Stage 1 step showing "Invoice to follow → the receipt
   is `Received — invoice pending`... Pay now → ...no AP is [created]."
2. **Migration plan** — this is closer to a from-scratch `prisma migrate dev`
   than a live-data migration, since the tables it creates don't currently
   exist. Still explicit: what's genuinely new vs. what FKs into Milestone
   One's surviving tables (`Supplier`, `InventoryItem`, `Location`).
3. **API contract** — every endpoint: method, path, request/response shapes,
   error cases, auth + role, as shared Zod schemas/TS types. Cover both the
   happy path and the business-state branches surfaced by the walkthrough
   (mismatch/dispute, overpayment/credit, partial payment). Match
   Non-Negotiables: `organizationId` in every repository query,
   `authenticate` + `requireRole` on every route, Zod validation on every
   input.
4. **Session breakdown** — the Step 7 build split into scoped sessions
   (schema/migration first, then services, then endpoints, matching §8's
   sequencing rule), what backend/frontend sessions can run in parallel once
   the contract is frozen. If you decided above that the Milestone Two
   component inventory (`04-components.md`) isn't yet built, its build
   session belongs at the front of this breakdown, not implied.
5. **Test classification** — there's nothing to keep/rewrite from a prior
   Milestone Two build (this is the milestone's first pass), so this is
   primarily "new tests required from the new flows" — but check whether any
   currently-passing test still references the dropped `PurchaseOrder`/
   `SupplierInvoice`/`SupplierPayment` shapes and would break or go stale
   once this milestone's models land under the same names.

## Non-negotiables (restating, don't violate these in the plan)

- Central Store hub-org scoping (D-15) — Central Store data lives only on
  the hub Organization.
- Business logic in services only; DB queries in repositories only.
- New code goes in `backend/src/modules/inventory/`.
- Every endpoint: Zod schema + `authenticate` + `requireRole`.
- TypeScript strict, no `any`.

## Process

- Use a live todo list throughout — this is a multi-step session, and the
  screen walkthrough alone covers 10 screens × 2 surfaces × several states.
- **Stop after producing the plan.** Do not begin Step 7 (build sessions).
  The owner reviews and approves `milestone-2-plan.md` first.
- Freezing the contract (Step 6) is just committing the already-designed
  types and marking them frozen in `docs/API_CONTRACT.md` once the plan is
  approved — it doesn't need its own separate session unless the owner says
  otherwise.
- If you hit a genuine ambiguity the approved flows/screens/design don't
  resolve — including but not limited to the payment-terms enum question
  above — ask the owner rather than guessing. Anything touching the new
  schema's shape is effectively load-bearing for every Step 7 session that
  follows.
